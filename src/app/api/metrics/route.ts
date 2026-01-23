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
import { getRedisClient } from '@/lib/redis-client';

const redis = getRedisClient();

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
    _debug?: any;
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

    // Aggregate wins/losses from user profiles
    for (const username of allUsers) {
        const profile = await redis.hgetall(`user:profile:${username}`) as Record<string, any>;
        if (profile && profile.totalAnalyses) {
            totalAnalyses += parseInt(profile.totalAnalyses) || 0;
            totalWins += parseInt(profile.wins) || 0;
            totalLosses += parseInt(profile.losses) || 0;
        }
    }

    // Get platform-wide Ticker Stats
    const trackedTickers = await redis.smembers('tracked_tickers') as string[];
    const tickerCounts: { key: string, count: number }[] = [];

    // Sort all tickers by call count (using SCARD is cheap)
    const pipeline = redis.pipeline();
    for (const key of trackedTickers) {
        pipeline.scard(`ticker_index:${key}`);
    }
    const counts = await pipeline.exec();

    trackedTickers.forEach((key, i) => {
        tickerCounts.push({ key, count: counts[i] as number });
    });

    const topTickerKeys = tickerCounts
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const topTickers: TickerStats[] = [];

    // For the top 5, aggregate their sentiment/win stats
    for (const { key, count } of topTickerKeys) {
        const symbol = key.split(':').pop() || key;
        const refs = await redis.smembers(`ticker_index:${key}`) as string[];

        let bullish = 0;
        let bearish = 0;
        let wins = 0;
        let losses = 0;

        // Fetch each analysis ref
        const analysisPipeline = redis.pipeline();
        for (const ref of refs) {
            const [user, id] = ref.split(':');
            analysisPipeline.lrange(`user:history:${user.toLowerCase()}`, 0, -1);
        }
        const userHistories = await analysisPipeline.exec();

        // Find the specific analysis in the history list
        refs.forEach((ref, i) => {
            const [user, id] = ref.split(':');
            const history = userHistories[i] as any[];
            const analysis = history.find(h => {
                const p = typeof h === 'string' ? JSON.parse(h) : h;
                return p.id === id;
            });

            if (analysis) {
                const p = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
                if (p.sentiment === 'BULLISH') bullish++;
                else bearish++;
                if (p.isWin) wins++;
                else losses++;
            }
        });

        topTickers.push({
            symbol,
            callCount: count,
            bullish,
            bearish,
            wins,
            losses
        });
    }

    // Still scan most recent for distributions (sentiment/type)
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
        _debug: {
            urlSet: !!(process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.KV_REST_API_URL),
            client: redis.constructor.name,
            env: process.env.NODE_ENV,
        }
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
    } catch (error: any) {
        console.error('[Metrics API] Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch metrics',
                details: error.message,
                stack: error.stack,
                _debug: {
                    urlSet: !!(process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.KV_REST_API_URL),
                    env: process.env.NODE_ENV
                }
            },
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
