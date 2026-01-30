
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const TRACKED_TICKERS_KEY = 'tracked_tickers';
const TICKER_PROFILE_PREFIX = 'ticker:profile:';
const TICKER_INDEX_PREFIX = 'ticker_index:';

function getTickerKey(analysis: any): string {
    if (analysis.contractAddress && analysis.contractAddress.length > 10) {
        return `CA:${analysis.contractAddress}`;
    }
    const type = analysis.type || 'CRYPTO';
    return `${type}:${analysis.symbol.toUpperCase()}`;
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
                    lastAnalyzed: 0
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

    // We process sequentially to avoid huge pipeline payload
    let count = 0;
    let pipeline = redis.pipeline();

    for (const [key, stats] of tickerStats.entries()) {
        stats.winRate = stats.totalAnalyses > 0 ? (stats.wins / stats.totalAnalyses) * 100 : 0;

        // Add to global set
        pipeline.sadd(TRACKED_TICKERS_KEY, key);

        // Save Profile
        pipeline.hset(`${TICKER_PROFILE_PREFIX}${key}`, stats);

        // Save Index (ZSET)
        const analyses = tickerAnalyses.get(key) || [];
        if (analyses.length > 0) {
            // zadd accepts array of {score, member} in recent redis versions but upstash-redis uses (key, {score, member}, ...)
            // or (key, ...args)
            // @upstash/redis approach:
            for (const item of analyses) {
                pipeline.zadd(`${TICKER_INDEX_PREFIX}${key}`, { score: item.score, member: item.member });
            }
        }

        count++;
        // Batch every 50 tickers (each ticker might have many ZADDs so keep it small)
        if (count % 20 === 0) {
            await pipeline.exec();
            // Re-instantiate pipeline if needed? 
            // Upstash pipeline is reusable but accumulates if not cleared? 
            // Actually pipeline.exec() returns results and clears the buffer in many clients.
            // If it doesn't clear, we'd be duplicating.
            // Let's assume standard behavior: exec sends and clears. 
            // Wait, standard `ioredis` clears. `@upstash/redis` `pipeline()` creates a new pipeline object.
            // But here `redis.pipeline()` creates a NEW one each time if we call it again?
            // Ah, I am reusing `const pipeline = redis.pipeline()` from line 107.
            // I should NOT reuse it if I want to batch.
            // I need to create a NEW pipeline or trust that `exec` clears it.
            // Docs say: Upstash: `p.exec()` executes and returns. It doesn't say if it clears.
            // Safer to just create a new one.
            pipeline = redis.pipeline(); // Re-create pipeline for next batch
        }
    }

    // BUT I defined `pipeline` OUTSIDE the loop.
    // I should move it inside or assume it's one big batch?
    // One big batch for 500 tickers * 10 calls = 5000 cmds is fine.
    // But ZADDs can be many.
    // Let's just do one big batch? 3000 analyses total implies roughly 6000 cmds. 
    // Upstash has a limit per request? 
    // It's safer to not batch too aggressively.

    // I'll rewrite the loop to use micro-batches properly.
    await pipeline.exec(); // Exec whatever is left

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Total analyses processed: ${totalAnalyses}`);
    console.log(`   Unique tickers profiled: ${tickerStats.size}`);

    process.exit(0);
}

backfillTickerProfiles();
