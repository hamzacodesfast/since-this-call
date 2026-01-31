
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load Env
// Load Env in correct order (Local first)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';

const redis = getRedisClient();

const TRACKED_TICKERS_KEY = 'tracked_tickers';
const TICKER_PROFILE_PREFIX = 'ticker:profile:';
const TICKER_INDEX_PREFIX = 'ticker_index:';

function getTickerKey(analysis: any): string {
    const symbol = (analysis.symbol || 'UNKNOWN').toUpperCase();
    const type = analysis.type || 'CRYPTO';
    return `${type}:${symbol}`;
}

async function backfillTickerProfiles() {
    console.log('🔄 Backfilling ticker profiles (PURGING MEME COINS)...\n');

    // 2. Clear existing indices using the TRACKED_TICKERS set (safer than KEYS)
    const existingTickers = await redis.smembers(TRACKED_TICKERS_KEY) as string[];
    console.log(`Clearing ${existingTickers.length} old tickers from index...`);

    if (existingTickers.length > 0) {
        const p = redis.pipeline();
        for (const tickerKey of existingTickers) {
            p.del(`${TICKER_INDEX_PREFIX}${tickerKey}`);
            p.del(`${TICKER_PROFILE_PREFIX}${tickerKey}`);
        }
        p.del(TRACKED_TICKERS_KEY);
        await p.exec();
    }

    // 2. Get all users
    const users = await redis.smembers('all_users') as string[];
    console.log(`Found ${users.length} users to process`);

    const tickerStats = new Map<string, any>();
    const tickerAnalyses = new Map<string, { member: string, score: number }[]>();
    let totalAnalyses = 0;
    let skippedMemes = 0;

    // 3. Aggregate stats in memory
    for (const username of users) {
        const historyKey = `user:history:${username}`;
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        for (const analysis of history) {
            // FILTER: Skip anything with a contract address
            // This now removes EVERYTHING that was ever indexed with a CA, including previous "known" ones.
            if (analysis.contractAddress) {
                skippedMemes++;
                continue;
            }
            const symbol = (analysis.symbol || 'UNKNOWN').toUpperCase();
            const tickerKey = getTickerKey(analysis);

            // Stats
            if (!tickerStats.has(tickerKey)) {
                tickerStats.set(tickerKey, {
                    symbol: symbol,
                    type: analysis.type || 'CRYPTO',
                    totalAnalyses: 0,
                    wins: 0,
                    losses: 0,
                    neutral: 0,
                    bullish: 0,
                    bearish: 0,
                    winRate: 0,
                    lastAnalyzed: 0
                });
            }

            const stats = tickerStats.get(tickerKey);
            stats.totalAnalyses++;
            stats.lastAnalyzed = Math.max(stats.lastAnalyzed, analysis.timestamp || 0);

            const perf = analysis.performance || 0;
            if (Math.abs(perf) < 0.01) {
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

    console.log(`\nAggregated ${totalAnalyses} analyses. Skipped ${skippedMemes} meme coins.`);

    // 4. Save Everything
    console.log(`💾 Saving data for ${tickerStats.size} tickers...`);

    let count = 0;
    for (const [key, stats] of tickerStats.entries()) {
        stats.winRate = stats.totalAnalyses > 0 ? (stats.wins / stats.totalAnalyses) * 100 : 0;

        try {
            const pipeline = redis.pipeline();
            pipeline.sadd(TRACKED_TICKERS_KEY, key);
            pipeline.hset(`${TICKER_PROFILE_PREFIX}${key}`, stats);

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

    // 5. Clear metrics cache
    await redis.del('leaderboard_metrics_cache');
    await redis.del('platform_metrics_cache');

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Total analyses indexed: ${totalAnalyses}`);
    console.log(`   Unique tickers profiled: ${tickerStats.size}`);

    process.exit(0);
}

backfillTickerProfiles().catch(console.error);
