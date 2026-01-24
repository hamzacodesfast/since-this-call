
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Redis } from '@upstash/redis';
import { LocalRedisWrapper } from '../src/lib/redis-wrapper';

// 1. Load Local Env (Source)
const localEnv = dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }).parsed;

// 2. Load Production Env (Destination)
const prodEnv = dotenv.config({ path: path.resolve(process.cwd(), '.env.production') }).parsed;

async function sync() {
    if (!prodEnv) {
        console.error('❌ .env.production not found. Cannot sync to production.');
        return;
    }

    console.log('⚠️  WARNING: This will OVERWRITE your PRODUCTION database with LOCAL data.');
    console.log('Production URL:', prodEnv.UPSTASH_REDIS_REST_KV_REST_API_URL);
    console.log('Press Ctrl+C in the next 5 seconds to cancel...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🔗 Connecting to Source (Local)...');
    const source = new LocalRedisWrapper(localEnv?.UPSTASH_REDIS_REST_KV_REST_API_URL || 'redis://localhost:6379');

    console.log('🔗 Connecting to Destination (Production)...');
    const dest = new Redis({
        url: prodEnv.UPSTASH_REDIS_REST_KV_REST_API_URL,
        token: prodEnv.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
    });

    try {
        console.log('🧹 Clearing production database...');
        await dest.flushdb();

        console.log('📦 Starting Sync to Production...');

        // Sync Global Stats
        console.log(' - Syncing recent_analyses...');
        const recent = await source.lrange('recent_analyses', 0, -1);
        if (recent.length > 0) {
            for (const item of recent.reverse()) {
                await dest.lpush('recent_analyses', JSON.stringify(item));
            }
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
            if (history.length > 0) {
                for (const item of history.reverse()) {
                    await dest.lpush(`user:history:${user}`, JSON.stringify(item));
                }
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

        console.log('\n✨ PRODUCTION SYNC COMPLETE!');
        console.log(`Synced ${allUsers.length} user profiles and ${tickers.length} tickers to Live.`);

    } catch (e: any) {
        console.error('\n❌ Production Sync Failed:', e.message);
    }
}

sync();
