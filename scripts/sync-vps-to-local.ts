
import * as dotenv from 'dotenv';
import * as path from 'path';
import { LocalRedisWrapper } from '../src/lib/redis-wrapper';

/**
 * sync-vps-to-local.ts
 * 
 * Pulls the latest production data from the VPS Redis to your LOCAL machine.
 * This is the replacement for the old Upstash sync.
 */

// 1. Load Local Env
const localEnv = dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }).parsed;

async function sync() {
    if (!localEnv) {
        console.error('❌ .env.local not found');
        return;
    }

    const VPS_REDIS_URL = localEnv.REDIS_URL; // On local, this should point to VPS
    const LOCAL_REDIS_URL = 'redis://localhost:6379';

    if (!VPS_REDIS_URL || !VPS_REDIS_URL.includes('204.168.130.15')) {
        console.error('❌ REDIS_URL in .env.local does not appear to point to the VPS IP (204.168.130.15).');
        console.log('   Please ensure your local .env.local is configured to connect to the VPS first.');
        return;
    }

    console.log('🔗 Connecting to Source (VPS Production)...');
    const source = new LocalRedisWrapper(VPS_REDIS_URL);

    console.log('🔗 Connecting to Destination (Local Docker/Native)...');
    const dest = new LocalRedisWrapper(LOCAL_REDIS_URL);

    try {
        console.log('🧹 Clearing local database...');
        await dest.flushdb();

        console.log('📦 Starting Sync...');

        // 1. Sync Global Stats
        console.log(' - Syncing recent_analyses...');
        const recent = await source.lrange('recent_analyses', 0, -1);
        const recentPipeline = dest.pipeline();
        for (const item of recent.reverse()) {
            recentPipeline.lpush('recent_analyses', typeof item === 'object' ? JSON.stringify(item) : item);
        }
        await recentPipeline.exec();

        // 2. Sync Users and Profiles
        console.log(' - Syncing users and profiles...');
        const allUsers = await source.smembers('all_users');
        if (allUsers.length > 0) {
            await dest.sadd('all_users', ...allUsers);
        }

        const CHUNK_SIZE = 50;
        for (let i = 0; i < allUsers.length; i += CHUNK_SIZE) {
            const chunk = allUsers.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async (user) => {
                const batchPipeline = dest.pipeline();
                const profile = await source.hgetall(`user:profile:${user}`);
                if (profile) batchPipeline.hset(`user:profile:${user}`, profile);
                const history = await source.lrange(`user:history:${user}`, 0, -1);
                if (history.length > 0) {
                    for (const item of history.reverse()) {
                        batchPipeline.lpush(`user:history:${user}`, typeof item === 'object' ? JSON.stringify(item) : item);
                    }
                }
                await batchPipeline.exec();
            }));
            console.log(`   [Sync] Processed ${i + chunk.length}/${allUsers.length} users...`);
        }

        // 3. Sync Tickers
        console.log(' - Syncing tickers and indices...');
        const tickers = await source.smembers('tracked_tickers');
        if (tickers.length > 0) {
            await dest.sadd('tracked_tickers', ...tickers);
        }

        for (const ticker of tickers) {
            const tickerPipe = dest.pipeline();
            const profile = await source.hgetall(`ticker:profile:${ticker}`);
            if (profile) tickerPipe.hset(`ticker:profile:${ticker}`, profile);
            const index = await source.zrange(`ticker_index:${ticker}`, 0, -1, { withScores: true });
            if (index.length > 0) {
                for (let i = 0; i < index.length; i += 2) {
                    tickerPipe.zadd(`ticker_index:${ticker}`, { score: Number(index[i + 1]), member: String(index[i]) });
                }
            }
            await tickerPipe.exec();
        }

        // 4. Global Index
        console.log(' - Syncing global index...');
        const globalIndex = await source.zrange('global:analyses:timestamp', 0, -1, { withScores: true });
        if (globalIndex.length > 0) {
            const globalPipe = dest.pipeline();
            for (let i = 0; i < globalIndex.length; i += 2) {
                globalPipe.zadd('global:analyses:timestamp', { score: Number(globalIndex[i + 1]), member: String(globalIndex[i]) });
            }
            await globalPipe.exec();
        }

        const metrics = await source.get('platform_metrics');
        if (metrics) await dest.set('platform_metrics', metrics);

        console.log('\n✨ Sync Complete!');
        process.exit(0);
    } catch (e: any) {
        console.error('\n❌ Sync Failed:', e.message);
        process.exit(1);
    }
}

sync();
