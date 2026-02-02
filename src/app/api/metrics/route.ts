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

    // 2. Get Ticker Stats directly from Redis (Pre-computed by backfill-tickers.ts)
    const trackedTickers = await redis.smembers('tracked_tickers') as string[];

    // Fetch all ticker profiles
    const tickerPipeline = redis.pipeline();
    for (const key of trackedTickers) {
        tickerPipeline.hgetall(`ticker:profile:${key}`);
    }
    const tickerProfiles = await tickerPipeline.exec() as any[];

    // 3. Aggregate Stats from Ticker Profiles
    let bullishCalls = 0;
    let bearishCalls = 0;
    let cryptoCalls = 0;
    let stockCalls = 0;

    const tickerList: TickerStats[] = [];

    tickerProfiles.forEach((stats: any, index: number) => {
        if (!stats) return;

        const callCount = parseInt(stats.totalAnalyses) || 0;
        const wins = parseInt(stats.wins) || 0;
        const losses = parseInt(stats.losses) || 0;
        const bullish = parseInt(stats.bullish) || 0;
        const bearish = parseInt(stats.bearish) || 0;

        bullishCalls += bullish;
        bearishCalls += bearish;

        if (stats.type === 'STOCK') stockCalls += callCount;
        else cryptoCalls += callCount; // Default to CRYPTO

        tickerList.push({
            symbol: stats.symbol || trackedTickers[index].split(':')[1],
            callCount,
            bullish,
            bearish,
            wins,
            losses
        });
    });

    // Sort and Top 100
    const topTickers = tickerList
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
