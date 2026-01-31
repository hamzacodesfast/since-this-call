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
}

/**
 * Compute metrics from Redis data (expensive - cached)
 */
async function computeMetrics(): Promise<PlatformMetrics> {
    // 1. Get Summary Stats (Overall)
    const allUsers = await redis.smembers('all_users') as string[];
    let totalAnalyses = 0;
    let totalWins = 0;
    let totalLosses = 0;

    // Aggregate wins/losses from user profiles
    const profilePipeline = redis.pipeline();
    for (const username of allUsers) {
        profilePipeline.hgetall(`user:profile:${username}`);
    }
    const profiles = await profilePipeline.exec();

    profiles.forEach((profile: any) => {
        if (profile && profile.totalAnalyses) {
            totalAnalyses += parseInt(profile.totalAnalyses) || 0;
            totalWins += parseInt(profile.wins) || 0;
            totalLosses += parseInt(profile.losses) || 0;
        }
    });

    // 2. Sample 500 Most Recent Analyses for Top Tickers & Distributions
    // This provides a rolling window of "Trends"
    const GLOBAL_ANALYSES_ZSET = 'global:analyses:timestamp';
    const recentRefs = await redis.zrange(GLOBAL_ANALYSES_ZSET, 0, 499, { rev: true }) as string[];

    // Group refs by user to minimize Redis calls
    const userMap: Record<string, Set<string>> = {};
    recentRefs.forEach(ref => {
        const [user, id] = ref.split(':');
        if (!userMap[user]) userMap[user] = new Set();
        userMap[user].add(id);
    });

    // Fetch histories for all users in the sample
    const historyPipeline = redis.pipeline();
    const usersInSample = Object.keys(userMap);
    for (const user of usersInSample) {
        historyPipeline.lrange(`user:history:${user}`, 0, -1);
    }
    const historyResults = await historyPipeline.exec();

    // Flatten and filter the 500 targeted analyses
    const windowAnalyses: any[] = [];
    usersInSample.forEach((user, idx) => {
        const historyData = historyResults[idx] as any[];
        const targetIds = userMap[user];
        if (historyData) {
            historyData.forEach(item => {
                const p = typeof item === 'string' ? JSON.parse(item) : item;
                if (targetIds.has(String(p.id))) {
                    windowAnalyses.push(p);
                }
            });
        }
    });

    // 3. Aggregate Stats from the 500-tweet window
    const tickerMap: Record<string, TickerStats> = {};
    let bullishCalls = 0;
    let bearishCalls = 0;
    let cryptoCalls = 0;
    let stockCalls = 0;

    // Resetting aggregation logic
    bullishCalls = 0;
    bearishCalls = 0;

    windowAnalyses.forEach(analysis => {
        const symbol = (analysis.symbol || 'UNKNOWN').toUpperCase();

        const tickerKey = `${analysis.type || 'CRYPTO'}:${symbol}`;

        if (!tickerMap[tickerKey]) {
            tickerMap[tickerKey] = {
                symbol: symbol,
                callCount: 0,
                bullish: 0,
                bearish: 0,
                wins: 0,
                losses: 0
            };
        }

        const stats = tickerMap[tickerKey];
        stats.callCount++;

        if (analysis.sentiment === 'BULLISH') {
            stats.bullish++;
            bullishCalls++;
        } else {
            stats.bearish++;
            bearishCalls++;
        }

        if (analysis.isWin) stats.wins++;
        else stats.losses++;

        if (analysis.type === 'CRYPTO') cryptoCalls++;
        else if (analysis.type === 'STOCK') stockCalls++;
    });

    // Sort and return top 100 tickers to allow for meaningful search
    const topTickers = Object.values(tickerMap)
        .sort((a, b) => b.callCount - a.callCount)
        .slice(0, 100);

    const winRate = (totalWins + totalLosses) > 0
        ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
        : 0;

    return {
        totalAnalyses,
        uniqueGurus: allUsers.length,
        totalWins,
        totalLosses,
        winRate,
        uniqueTickers: await redis.scard('tracked_tickers') || 0,
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
