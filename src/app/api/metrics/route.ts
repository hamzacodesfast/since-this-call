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

    profiles.forEach((result: any) => {
        const profile = Array.isArray(result) ? result[1] : result;
        if (profile && profile.totalAnalyses !== undefined) {
            totalAnalyses += parseInt(profile.totalAnalyses) || 0;
            totalWins += parseInt(profile.wins) || 0;
            totalLosses += parseInt(profile.losses) || 0;
        }
    });

    // 2. Calculate Trending Tickers (Last 1000 Analyses by Timestamp)
    const recentRefs = await redis.zrange('global:analyses:timestamp', 0, 999, { rev: true }) as string[];

    // We need to resolve these refs (username:id) to actual analyses to get the symbol
    // Optimization: Group by username to minimize calls
    const userMap = new Map<string, Set<string>>();
    recentRefs.forEach(ref => {
        const [username, id] = ref.split(':');
        if (!userMap.has(username)) userMap.set(username, new Set());
        userMap.get(username)!.add(id);
    });

    const trendingStats = new Map<string, TickerStats>();

    // Fetch histories for involved users
    const pipeline = redis.pipeline();
    const usernames = Array.from(userMap.keys());
    usernames.forEach(user => pipeline.lrange(`user:history:${user}`, 0, -1));
    const histories = await pipeline.exec() as any[];

    histories.forEach((result, i) => {
        const username = usernames[i];
        const targetIds = userMap.get(username)!;

        // result is the list of history items (strings)
        // Upstash/IORedis behavior: result might be [err, data] or just data. 
        // Assuming standard behavior (array of strings) or handling basic error structure.
        const historyList = Array.isArray(result) ? result : (result?.[1] as any[] || []);

        if (!Array.isArray(historyList)) return;

        historyList.forEach((itemStr: string) => {
            try {
                const analysis = typeof itemStr === 'string' ? JSON.parse(itemStr) : itemStr;
                if (targetIds.has(analysis.id)) {
                    // This is one of our recent tweets. Aggregate it.
                    const symbol = analysis.symbol.toUpperCase();
                    if (!trendingStats.has(symbol)) {
                        trendingStats.set(symbol, {
                            symbol,
                            callCount: 0,
                            bullish: 0,
                            bearish: 0,
                            wins: 0,
                            losses: 0
                        });
                    }

                    const stat = trendingStats.get(symbol)!;
                    stat.callCount++;
                    if (analysis.sentiment === 'BULLISH') stat.bullish++;
                    if (analysis.sentiment === 'BEARISH') stat.bearish++;
                    if (analysis.isWin) stat.wins++;
                    else if (Math.abs(analysis.performance || 0) > 0.01) stat.losses++;
                    // Note: 'neutral' isn't explicitly tracked in TickerStats interface properly for losses? 
                    // logic varies, but for "wins/losses" pure count: 
                    // isWin is usually strictly profit. 
                    // existing logic: wins = parseInt(stats.wins), losses = ...
                }
            } catch (e) { /* ignore parse error */ }
        });
    });

    // Convert map to array and sort
    const topTickers = Array.from(trendingStats.values())
        .sort((a, b) => b.callCount - a.callCount)
        .slice(0, 100);

    // 3. Fallback for Global Counts (bullishCalls, etc) - Keep using All-Time stats or aggregate?
    // The previous code calculated these from `tickerProfiles` (all time).
    // Accessing `ticker:profile:*` is still useful for *Platform Wide* totals (e.g. "Total Crypto Calls").
    // So we should KEEP fetching all ticker profiles for the global counters, 
    // BUT use the `trendingStats` for the `topTickers` return value.

    // Fetch all ticker profiles for GLOBAL SUMS
    const trackedTickers = await redis.smembers('tracked_tickers') as string[];
    const tickerPipeline = redis.pipeline();
    for (const key of trackedTickers) {
        tickerPipeline.hgetall(`ticker:profile:${key}`);
    }
    const tickerProfiles = await tickerPipeline.exec() as any[];

    let bullishCalls = 0;
    let bearishCalls = 0;
    let cryptoCalls = 0;
    let stockCalls = 0;

    tickerProfiles.forEach((stats: any) => {
        // Handle result wrapper if necessary
        // In some clients exec returns [error, result]. 
        // If stats is array? No, usually object if no error. 
        // Let's assume stats is the object or we need to extract it.
        // If using @upstash/redis, it returns the value directly.
        // Safety check:
        const data = Array.isArray(stats) ? stats[1] : stats;
        if (!data) return;

        const callCount = parseInt(data.totalAnalyses) || 0;
        bullishCalls += parseInt(data.bullish) || 0;
        bearishCalls += parseInt(data.bearish) || 0;
        if (data.type === 'STOCK') stockCalls += callCount;
        else cryptoCalls += callCount;
    });


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
