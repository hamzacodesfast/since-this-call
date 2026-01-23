
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Redis } from '@upstash/redis';
import { UnifiedRedis } from '../src/lib/redis-wrapper';

/**
 * scripts/sync-to-local.ts
 * Clones data from Production Upstash to Local Redis Proxy.
 */

async function sync() {
    // 1. Load Production Env
    const prodEnv = dotenv.config({ path: path.resolve(process.cwd(), '.env.production') }).parsed;
    if (!prodEnv) {
        console.error('❌ .env.production not found');
        return;
    }

    // 2. Load Local Env (or default)
    const localEnv = dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }).parsed;



    console.log('🔗 Connecting to Source (Production)...');
    const source = new Redis({
        url: prodEnv.UPSTASH_REDIS_REST_KV_REST_API_URL,
        token: prodEnv.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
    });

    console.log('🔗 Connecting to Destination (Local)...');
    const dest = new UnifiedRedis({
        url: localEnv?.UPSTASH_REDIS_REST_KV_REST_API_URL || 'redis://localhost:6379',
        token: localEnv?.UPSTASH_REDIS_REST_KV_REST_API_TOKEN || 'example_token',
    });

    try {
        console.log('🧹 Clearing local database...');
        await dest.flushdb();

        console.log('📦 Starting Sync...');

        // Sync Global Stats
        console.log(' - Syncing recent_analyses...');
        const recent = await source.lrange('recent_analyses', 0, -1);
        for (const item of recent.reverse()) {
            await dest.lpush('recent_analyses', JSON.stringify(item));
        }

        console.log(' - Syncing metrics and users...');
        const allUsers = await source.smembers('all_users');
        for (const user of allUsers) {
            await dest.sadd('all_users', user);

            // Sync Profile
            const profile = await source.hgetall(`user:profile:${user}`);
            if (profile) await dest.hset(`user:profile:${user}`, profile);

            // Sync History
            const history = await source.lrange(`user:history:${user}`, 0, -1);
            for (const item of history.reverse()) {
                await dest.lpush(`user:history:${user}`, JSON.stringify(item));
            }
            console.log(`   ✅ Synced @${user}`);
        }

        console.log(' - Syncing tickers...');
        const tickers = await source.smembers('tracked_tickers');
        for (const ticker of tickers) {
            await dest.sadd('tracked_tickers', ticker);
            const index = await source.smembers(`ticker_index:${ticker}`);
            for (const ref of index) {
                await dest.sadd(`ticker_index:${ticker}`, ref);
            }
        }

        const metrics = await source.get('platform_metrics');
        if (metrics) await dest.set('platform_metrics', JSON.stringify(metrics));

        console.log('\n✨ Sync Complete!');
        console.log(`Synced ${allUsers.length} user profiles and ${tickers.length} tickers.`);

    } catch (e: any) {
        console.error('\n❌ Sync Failed:', e.message);
    }
}

sync();
