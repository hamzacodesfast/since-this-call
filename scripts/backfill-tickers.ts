
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

import { getRedisClient } from '../src/lib/redis-client';
import { KNOWN_CAS } from '../src/lib/market-data';

const redis = getRedisClient();

const TRACKED_TICKERS_KEY = 'tracked_tickers';
const TICKER_PROFILE_PREFIX = 'ticker:profile:';
const TICKER_INDEX_PREFIX = 'ticker_index:';

function getTickerKey(analysis: any): string {
    const symbol = analysis.symbol.toUpperCase();
    const knownCA = KNOWN_CAS[symbol];
    const effectiveCA = knownCA ? knownCA.ca : analysis.contractAddress;

    if (effectiveCA && effectiveCA.length > 10) {
        return `CA:${effectiveCA}`;
    }
    const type = analysis.type || 'CRYPTO';
    return `${type}:${symbol}`;
}

async function backfillTickerProfiles() {
    console.log('🔄 Backfilling ticker profiles and index (ZSET conversion)...\n');

    // 1. Get existing tickers to clear
    const existingTickers = await redis.smembers(TRACKED_TICKERS_KEY) as string[];
    console.log(`Clearing data for ${existingTickers.length} existing tickers...`);

    if (existingTickers.length > 0) {
        const pipeline = redis.pipeline();
        for (const t of existingTickers) {
            pipeline.del(`${TICKER_PROFILE_PREFIX}${t}`);
            pipeline.del(`${TICKER_INDEX_PREFIX}${t}`);
        }
        pipeline.del(TRACKED_TICKERS_KEY);
        await pipeline.exec();
    }

    // 2. Get all users
    const users = await redis.smembers('all_users') as string[];
    console.log(`Found ${users.length} users to process`);

    const tickerStats = new Map<string, any>();
    const tickerAnalyses = new Map<string, { member: string, score: number }[]>();
    let totalAnalyses = 0;

    // 3. Aggregate stats in memory
    for (const username of users) {
        const historyKey = `user:history:${username}`;
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        for (const analysis of history) {
            const tickerKey = getTickerKey(analysis);

            // Stats
            if (!tickerStats.has(tickerKey)) {
                tickerStats.set(tickerKey, {
                    symbol: analysis.symbol.toUpperCase(),
                    type: analysis.type || 'CRYPTO',
                    totalAnalyses: 0,
                    wins: 0,
                    losses: 0,
                    neutral: 0,
                    bullish: 0,
                    bearish: 0,
                    winRate: 0,
                    lastAnalyzed: 0,
                    contractAddress: tickerKey.startsWith('CA:') ? tickerKey.split(':')[1] : undefined
                });
            }

            const stats = tickerStats.get(tickerKey);
            stats.totalAnalyses++;
            stats.lastAnalyzed = Math.max(stats.lastAnalyzed, analysis.timestamp || 0);

            if (Math.abs(analysis.performance) < 0.01) {
                stats.neutral++;
            } else if (analysis.isWin) {
                stats.wins++;
            } else {
                stats.losses++;
            }

            if (analysis.sentiment === 'BULLISH') {
                stats.bullish++;
            } else if (analysis.sentiment === 'BEARISH') {
                stats.bearish++;
            }

            // Index
            if (!tickerAnalyses.has(tickerKey)) {
                tickerAnalyses.set(tickerKey, []);
            }
            tickerAnalyses.get(tickerKey)!.push({
                member: `${username.toLowerCase()}:${analysis.id}`,
                score: analysis.timestamp || 0
            });

            totalAnalyses++;
        }
    }

    // 4. Save Everything
    console.log(`\n💾 Saving data for ${tickerStats.size} tickers...`);

    // 4. Save Everything
    console.log(`\n💾 Saving data for ${tickerStats.size} tickers...`);

    let count = 0;
    for (const [key, stats] of tickerStats.entries()) {
        stats.winRate = stats.totalAnalyses > 0 ? (stats.wins / stats.totalAnalyses) * 100 : 0;

        try {
            const pipeline = redis.pipeline();
            // Add to global set
            pipeline.sadd(TRACKED_TICKERS_KEY, key);

            // Save Profile (Remove undefined fields to avoid RedisEmptyError)
            const cleanStats = { ...stats };
            if (!cleanStats.contractAddress) delete cleanStats.contractAddress;

            pipeline.hset(`${TICKER_PROFILE_PREFIX}${key}`, cleanStats);
            // Save Index (ZSET)
            const analyses = tickerAnalyses.get(key) || [];
            for (const item of analyses) {
                pipeline.zadd(`${TICKER_INDEX_PREFIX}${key}`, { score: item.score, member: item.member });
            }
            await pipeline.exec();

            count++;
            if (count % 50 === 0) {
                console.log(`   Processed ${count}/${tickerStats.size} tickers...`);
            }
        } catch (e) {
            console.error(`   Failed to save ticker ${key}:`, e);
        }
    }

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Total analyses processed: ${totalAnalyses}`);
    console.log(`   Unique tickers profiled: ${tickerStats.size}`);

    process.exit(0);
}

backfillTickerProfiles();
