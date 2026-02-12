
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

        // Batch profile and history sync (PARALLELIZED)
        const CHUNK_SIZE = 50;
        let syncedUsers = 0;

        for (let i = 0; i < allUsers.length; i += CHUNK_SIZE) {
            const chunk = allUsers.slice(i, i + CHUNK_SIZE);

            await Promise.all(chunk.map(async (user) => {
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
            }));

            syncedUsers += chunk.length;
            console.log(`   [Sync] Processed ${syncedUsers}/${allUsers.length} users...`);
        }
        console.log(`   ✅ Synced ${allUsers.length} profiles.`);

        // 3. Sync Tickers
        console.log(' - Syncing tickers and indices...');
        const tickers = await source.smembers('tracked_tickers');
        if (tickers.length > 0) {
            const tickerPipeline = dest.pipeline();
            // batch global set add
            tickerPipeline.sadd('tracked_tickers', ...tickers);
            await tickerPipeline.exec();
        }

        let tickerCount = 0;
        const tickerPipeline = dest.pipeline();

        for (const ticker of tickers) {
            // Sync Profile (Hash)
            const profile = await source.hgetall(`ticker:profile:${ticker}`);
            if (profile) {
                tickerPipeline.hset(`ticker:profile:${ticker}`, profile);
            }

            // Sync Index (ZSET)
            // Use zrange withScores to get all items
            const index = await source.zrange(`ticker_index:${ticker}`, 0, -1, { withScores: true });

            if (index.length > 0) {
                // Upstash/IORedis array: [member, score, member, score...]
                for (let i = 0; i < index.length; i += 2) {
                    const member = index[i] as string;
                    const score = index[i + 1] as number; // or string depending on lib, but ZADD handles comparison
                    if (member) {
                        tickerPipeline.zadd(`ticker_index:${ticker}`, { score: Number(score), member });
                    }
                }
            }

            tickerCount++;
            if (tickerCount % 50 === 0) {
                await tickerPipeline.exec();
                // pipeline auto-flushes in ioredis but explicitly calling exec is safe?
                // Actually need to carefully manage pipeline object reuse if it's not clearing.
                // Assuming dest.pipeline() creates a new one each time is cleaner.
            }
        }
        await tickerPipeline.exec();
        console.log(`   ✅ Synced ${tickers.length} tickers.`);
        // 4. Sync Global Analyses Index (ZSET)
        console.log(' - Syncing global timestamp index...');
        const GLOBAL_ANALYSES_ZSET = 'global:analyses:timestamp';
        const zrange = await source.zrange(GLOBAL_ANALYSES_ZSET, 0, -1, { withScores: true });

        if (zrange.length > 0) {
            const zsetPipeline = dest.pipeline();
            // Upstash returns [member, score, member, score...] or [{member, score}...] depending on client version
            // But typical ioredis/upstash zrange withScores returns alternating array.
            // Let's safe-handle it.
            for (let i = 0; i < zrange.length; i += 2) {
                const member = zrange[i];
                const score = zrange[i + 1];
                if (member && score) {
                    zsetPipeline.zadd(GLOBAL_ANALYSES_ZSET, { score: Number(score), member: String(member) });
                }
            }
            await zsetPipeline.exec();
        }
        console.log(`   ✅ Synced global index (${zrange.length / 2} items).`);

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
