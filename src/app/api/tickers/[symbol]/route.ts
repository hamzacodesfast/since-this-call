
import { NextRequest, NextResponse } from 'next/server';
import { getTickerProfile, getTickerAnalyses, getUserProfile } from '@/lib/analysis-store';
import { Redis } from '@upstash/redis';
import { getRedisClient } from '@/lib/redis-client';

const redis = getRedisClient();

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { symbol: string } }
) {
    const symbol = params.symbol.toUpperCase();

    // Determine type from query param or try both
    const url = new URL(request.url);
    const typeParam = url.searchParams.get('type') as 'CRYPTO' | 'STOCK' | null;

    try {
        // 1. Get Profile
        // If type not specified, try CRYPTO first then STOCK? 
        // Or assume symbol is unique enough? 
        // Our storage uses TYPE:SYMBOL keys.
        // Let's try CRYPTO first, if null try STOCK.

        let profile = await getTickerProfile(symbol, 'CRYPTO');
        if (!profile) {
            profile = await getTickerProfile(symbol, 'STOCK');
        }

        if (!profile) {
            return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
        }

        // 2. Get Recent Analyses IDs
        const tickerKey = `${profile.type}:${symbol}`;
        const analysisRefs = await getTickerAnalyses(tickerKey, 50); // Limit 50

        // 3. Fetch Analyses Details
        // Refs are "username:id"
        // We need to fetch the actual analysis objects.
        // As noted, we have to look them up in user history.

        const analyses = [];
        const pipeline = redis.pipeline();

        // Optimization: We can't easily pipeline "find ID in list".
        // But we DO know the username.
        // If we strictly want to be efficient, we'd need an ID->Analysis map.
        // Given we don't, we have to iterate user history.

        // LIMITATION: Fetching 50 user histories is heavy.
        // BUT, usually a ticker page won't have 50 *different* users in the last 50 calls.
        // It might be same users spamming.
        // Let's group by username to minimize fetches.

        const userMap = new Map<string, string[]>(); // username -> [ids]
        for (const ref of analysisRefs) {
            const [username, id] = ref.split(':');
            if (!userMap.has(username)) userMap.set(username, []);
            userMap.get(username)!.push(id);
        }

        // Fetch histories for all unique users
        const usernames = Array.from(userMap.keys());
        for (const u of usernames) {
            pipeline.lrange(`user:history:${u}`, 0, -1);
        }

        const histories = await pipeline.exec();

        // Map histories back to requested IDs
        for (let i = 0; i < histories.length; i++) {
            const username = usernames[i];
            const targetIds = new Set(userMap.get(username));

            // Handle IORedis/Upstash wrapper result format
            // Assuming local-redis-proxy or direct client returns data directly or [err, data]
            // Safe access:
            const result = histories[i] as any;
            const historyData = Array.isArray(result) && (result.length === 0 || !result[0]?.error) ? result : (result[1] || []);
            // IORedis: [null, [item, item]]
            // Upstash: [item, item]
            // check redis-client behavior if needed later. 
            // For now assume array of strings/objects.

            const historyList = (Array.isArray(result) && result[0] === null) ? result[1] : result;

            if (Array.isArray(historyList)) {
                for (const item of historyList) {
                    const analysis = typeof item === 'string' ? JSON.parse(item) : item;
                    if (targetIds.has(analysis.id)) {
                        analyses.push(analysis);
                    }
                }
            }
        }

        // Sort by timestamp desc
        analyses.sort((a, b) => b.timestamp - a.timestamp);

        return NextResponse.json({
            profile,
            analyses
        });

    } catch (error) {
        console.error('Ticker detail error:', error);
        return NextResponse.json({ error: 'Failed to fetch ticker details' }, { status: 500 });
    }
}
