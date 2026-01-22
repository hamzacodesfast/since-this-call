/**
 * @file /api/metrics/route.ts
 * @description API endpoint for platform-wide metrics
 * 
 * Returns aggregated stats:
 * - Total analyses tracked
 * - Unique gurus (users)
 * - Overall win rate
 * - Unique tickers being tracked
 * 
 * Cached in Redis for 15 minutes to reduce load.
 */
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const METRICS_CACHE_KEY = 'platform_metrics';
const CACHE_TTL = 15 * 60; // 15 minutes

export interface TickerStats {
    symbol: string;
    callCount: number;
    bullish: number;
    bearish: number;
    wins: number;
    losses: number;
}

export interface PlatformMetrics {
    totalAnalyses: number;
    uniqueGurus: number;
    totalWins: number;
    totalLosses: number;
    winRate: number;
    uniqueTickers: number;
    bullishCalls: number;
    bearishCalls: number;
    cryptoCalls: number;
    stockCalls: number;
    topTickers: TickerStats[];
    lastUpdated: number;
}

/**
 * Compute metrics from Redis data (expensive - cached)
 */
async function computeMetrics(): Promise<PlatformMetrics> {
    // Get all users
    const allUsers = await redis.smembers('all_users') as string[];

    let totalAnalyses = 0;
    let totalWins = 0;
    let totalLosses = 0;

    // Ticker aggregation map (from ALL user histories)
    const tickerMap = new Map<string, TickerStats>();

    // Aggregate wins/losses from user profiles AND get ticker stats from histories
    for (const username of allUsers) {
        const profile = await redis.hgetall(`user:profile:${username}`) as Record<string, any>;
        if (profile && profile.totalAnalyses) {
            totalAnalyses += parseInt(profile.totalAnalyses) || 0;
            totalWins += parseInt(profile.wins) || 0;
            totalLosses += parseInt(profile.losses) || 0;
        }

        // Get all analyses from this user's history for ticker aggregation
        const history = await redis.lrange(`user:history:${username}`, 0, -1);
        for (const item of history) {
            const analysis = typeof item === 'string' ? JSON.parse(item) : item;
            const symbol = analysis.symbol;
            if (symbol) {
                if (!tickerMap.has(symbol)) {
                    tickerMap.set(symbol, {
                        symbol,
                        callCount: 0,
                        bullish: 0,
                        bearish: 0,
                        wins: 0,
                        losses: 0,
                    });
                }
                const stats = tickerMap.get(symbol)!;
                stats.callCount++;
                if (analysis.sentiment === 'BULLISH') stats.bullish++;
                else if (analysis.sentiment === 'BEARISH') stats.bearish++;
                if (analysis.isWin) stats.wins++;
                else stats.losses++;
            }
        }
    }

    // Get sentiment/type from most recent 100 analyses for distribution charts
    let bullishCalls = 0;
    let bearishCalls = 0;
    let cryptoCalls = 0;
    let stockCalls = 0;

    const recentAnalyses = await redis.lrange('recent_analyses', 0, 99);
    for (const item of recentAnalyses) {
        const analysis = typeof item === 'string' ? JSON.parse(item) : item;
        if (analysis.sentiment === 'BULLISH') bullishCalls++;
        else if (analysis.sentiment === 'BEARISH') bearishCalls++;
        if (analysis.type === 'CRYPTO') cryptoCalls++;
        else if (analysis.type === 'STOCK') stockCalls++;
    }

    // Sort tickers by call count and get top 5
    const topTickers = Array.from(tickerMap.values())
        .sort((a, b) => b.callCount - a.callCount)
        .slice(0, 5);

    // Get unique tickers
    const trackedTickers = await redis.smembers('tracked_tickers') as string[];

    const winRate = totalAnalyses > 0
        ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
        : 0;

    return {
        totalAnalyses,
        uniqueGurus: allUsers.length,
        totalWins,
        totalLosses,
        winRate,
        uniqueTickers: trackedTickers.length,
        bullishCalls,
        bearishCalls,
        cryptoCalls,
        stockCalls,
        topTickers,
        lastUpdated: Date.now(),
    };
}

export async function GET() {
    try {
        // Check cache first
        const cached = await redis.get(METRICS_CACHE_KEY) as PlatformMetrics | null;

        if (cached) {
            return NextResponse.json(cached);
        }

        // Compute fresh metrics
        const metrics = await computeMetrics();

        // Cache for 15 minutes
        await redis.set(METRICS_CACHE_KEY, JSON.stringify(metrics), { ex: CACHE_TTL });

        return NextResponse.json(metrics);
    } catch (error) {
        console.error('[Metrics API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch metrics' },
            { status: 500 }
        );
    }
}

/**
 * POST: Force refresh metrics (for cron job or admin)
 */
export async function POST() {
    try {
        // Clear cache
        await redis.del(METRICS_CACHE_KEY);

        // Recompute
        const metrics = await computeMetrics();

        // Cache
        await redis.set(METRICS_CACHE_KEY, JSON.stringify(metrics), { ex: CACHE_TTL });

        return NextResponse.json({
            success: true,
            message: 'Metrics refreshed',
            metrics
        });
    } catch (error) {
        console.error('[Metrics API] Refresh error:', error);
        return NextResponse.json(
            { error: 'Failed to refresh metrics' },
            { status: 500 }
        );
    }
}
