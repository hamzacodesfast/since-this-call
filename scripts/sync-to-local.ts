
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Redis } from '@upstash/redis';
import { LocalRedisWrapper } from '../src/lib/redis-wrapper';

// 1. Load Production Env
const prodEnv = dotenv.config({ path: path.resolve(process.cwd(), '.env.production') }).parsed;

// 2. Load Local Env (or default)
const localEnv = dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }).parsed;

async function sync() {
    if (!prodEnv) {
        console.error('❌ .env.production not found');
        return;
    }

    console.log('🔗 Connecting to Source (Production)...');
    const source = new Redis({
        url: prodEnv.UPSTASH_REDIS_REST_KV_REST_API_URL,
        token: prodEnv.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
    });


    console.log('🔗 Connecting to Destination (Local)...');
    const dest = new LocalRedisWrapper(localEnv?.UPSTASH_REDIS_REST_KV_REST_API_URL || 'redis://localhost:6379');

    try {
        console.log('🧹 Clearing local database...');
        await dest.flushdb();

        console.log('📦 Starting Sync...');

        // 1. Sync Global Stats
        console.log(' - Syncing recent_analyses...');
        const recent = await source.lrange('recent_analyses', 0, -1);
        const recentPipeline = dest.pipeline();
        // Since we want the same order as production (LIFO), and we are rebuilding:
        // Source lrange returns index 0 (newest) to last (oldest).
        // To preserve this via LPUSH, we must push the oldest first OR use RPUSH.
        // The original script reversed them and used LPUSH.
        for (const item of recent.reverse()) {
            recentPipeline.lpush('recent_analyses', typeof item === 'object' ? JSON.stringify(item) : item);
        }
        await recentPipeline.exec();

        // 2. Sync Users and Profiles
        console.log(' - Syncing users and profiles...');
        const allUsers = await source.smembers('all_users');
        if (allUsers.length > 0) {
            const userPipeline = dest.pipeline();
            for (const user of allUsers) {
                userPipeline.sadd('all_users', user);
            }
            await userPipeline.exec();
        }

        // Batch profile and history sync
        for (const user of allUsers) {
            const batchPipeline = dest.pipeline();

            // Sync Profile
            const profile = await source.hgetall(`user:profile:${user}`);
            if (profile) {
                batchPipeline.hset(`user:profile:${user}`, profile);
            }

            // Sync History
            const history = await source.lrange(`user:history:${user}`, 0, -1);
            if (history.length > 0) {
                for (const item of history.reverse()) {
                    batchPipeline.lpush(`user:history:${user}`, typeof item === 'object' ? JSON.stringify(item) : item);
                }
            }

            await batchPipeline.exec();
            // console.log(`   ✅ Synced @${user}`);
        }
        console.log(`   ✅ Synced ${allUsers.length} profiles.`);

        // 3. Sync Tickers
        console.log(' - Syncing tickers and indices...');
        const tickers = await source.smembers('tracked_tickers');
        if (tickers.length > 0) {
            const tickerPipeline = dest.pipeline();
            for (const ticker of tickers) {
                tickerPipeline.sadd('tracked_tickers', ticker);
            }
            await tickerPipeline.exec();
        }

        for (const ticker of tickers) {
            const index = await source.smembers(`ticker_index:${ticker}`);
            if (index.length > 0) {
                const indexPipeline = dest.pipeline();
                for (const ref of index) {
                    indexPipeline.sadd(`ticker_index:${ticker}`, ref);
                }
                await indexPipeline.exec();
            }
        }
        console.log(`   ✅ Synced ${tickers.length} tickers.`);

        const metrics = await source.get('platform_metrics');
        if (metrics) await dest.set('platform_metrics', metrics);

        console.log('\n✨ Sync Complete!');
        console.log(`Synced ${allUsers.length} user profiles and ${tickers.length} tickers.`);
        process.exit(0);

    } catch (e: any) {
        console.error('\n❌ Sync Failed:', e.message);
        process.exit(1);
    }
}

sync();
