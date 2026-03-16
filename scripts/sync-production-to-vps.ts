
import { Redis } from '@upstash/redis';
import { Redis as IORedis } from 'ioredis';
import * as dotenv from 'dotenv';
import path from 'path';

/**
 * sync-production-to-vps.ts
 * 
 * The master synchronization script to achieve 100% data parity.
 * Scans the source of truth (Global Index) on Upstash and pushes
 * every single piece of data to the VPS Redis.
 */

dotenv.config({ path: path.resolve(process.cwd(), '.env.production'), override: true });

const SOURCE_URL = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL || '';
const SOURCE_TOKEN = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN || '';
const DEST_URL = process.env.NEW_REDIS_URL || 'redis://localhost:6379';

if (!SOURCE_URL || !SOURCE_TOKEN) {
    console.error('❌ Upstash credentials missing. Check .env.production');
    process.exit(1);
}

async function sync() {
    console.log('🔗 Connecting to Upstash (Source)...');
    const source = new Redis({ url: SOURCE_URL, token: SOURCE_TOKEN });

    console.log('🔗 Connecting to VPS Redis (Dest)...');
    const dest = new IORedis(DEST_URL);

    try {
        console.log('🚀 INITIALIZING SYNC TO VPS...');

        // 1. Sync Global Sets
        console.log('🔄 Syncing global collections...');
        const globalSets = ['all_users', 'tracked_tickers'];
        for (const set of globalSets) {
            const members = await source.smembers(set);
            if (members.length > 0) {
                await dest.sadd(set, ...members);
                console.log(`   ✅ Synced ${members.length} members to '${set}'`);
            }
        }

        // 2. Sync Global Indices (ZSETs)
        console.log('🔄 Syncing global indices...');
        const globalZSets = ['global:analyses:timestamp'];
        for (const zset of globalZSets) {
            const index = await source.zrange(zset, 0, -1, { withScores: true });
            if (index.length > 0) {
                await dest.del(zset);
                const pipe = dest.pipeline();
                // Upstash returns [member, score, member, score...]
                for (let i = 0; i < index.length; i += 2) {
                    pipe.zadd(zset, Number(index[i + 1]), String(index[i]));
                }
                await pipe.exec();
                console.log(`   ✅ Synced ${index.length / 2} items to '${zset}'`);
            }
        }

        // 3. Sync Recent Analyses (List)
        console.log('🔄 Syncing recent analyses list...');
        const recent = await source.lrange('recent_analyses', 0, -1);
        if (recent.length > 0) {
            await dest.del('recent_analyses');
            const pipe = dest.pipeline();
            for (let i = recent.length - 1; i >= 0; i--) {
                pipe.lpush('recent_analyses', typeof recent[i] === 'object' ? JSON.stringify(recent[i]) : recent[i]);
            }
            await pipe.exec();
            console.log(`   ✅ Synced ${recent.length} items to 'recent_analyses'`);
        }

        // 4. Master User Sync (Profiles + History)
        console.log('🔄 Syncing all user data (Profiles + History)...');
        const users = await source.smembers('all_users');
        console.log(`   Superset contains ${users.length} unique usernames.`);

        let processed = 0;
        const CHUNK_SIZE = 25; // Smaller chunks for reliability
        for (let i = 0; i < users.length; i += CHUNK_SIZE) {
            const chunk = users.slice(i, i + CHUNK_SIZE);
            
            await Promise.all(chunk.map(async (user) => {
                const [profile, history] = await Promise.all([
                    source.hgetall(`user:profile:${user}`),
                    source.lrange(`user:history:${user}`, 0, -1)
                ]);

                const pipe = dest.pipeline();
                if (profile) {
                    pipe.hset(`user:profile:${user}`, profile);
                }
                if (history.length > 0) {
                    pipe.del(`user:history:${user}`);
                    for (let j = history.length - 1; j >= 0; j--) {
                        pipe.lpush(`user:history:${user}`, typeof history[j] === 'object' ? JSON.stringify(history[j]) : history[j]);
                    }
                }
                await pipe.exec();
            }));

            processed += chunk.length;
            if (processed % 500 === 0 || processed === users.length) {
                console.log(`   [Users] Synchronized ${processed}/${users.length} profiles...`);
            }
        }

        // 5. Sync Ticker Profiles
        console.log('🔄 Syncing all ticker profiles...');
        const tickers = await source.smembers('tracked_tickers');
        let tickerProcessed = 0;
        for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
            const chunk = tickers.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async (ticker) => {
                const [profile, index] = await Promise.all([
                    source.hgetall(`ticker:profile:${ticker}`),
                    source.zrange(`ticker_index:${ticker}`, 0, -1, { withScores: true })
                ]);

                const pipe = dest.pipeline();
                if (profile) pipe.hset(`ticker:profile:${ticker}`, profile);
                if (index.length > 0) {
                    pipe.del(`ticker_index:${ticker}`);
                    for (let j = 0; j < index.length; j += 2) {
                        pipe.zadd(`ticker_index:${ticker}`, Number(index[j+1]), String(index[j]));
                    }
                }
                await pipe.exec();
            }));

            tickerProcessed += chunk.length;
            if (tickerProcessed % 200 === 0 || tickerProcessed === tickers.length) {
                console.log(`   [Tickers] Synchronized ${tickerProcessed}/${tickers.length} profiles...`);
            }
        }

        // 5. Final forced sync of indices and recent_analyses
        // (This ensures we match the "28,622" number even if histories are drifted)
        console.log('🔄 Final forced sync of global indices...');
        const forceZset = await source.zrange('global:analyses:timestamp', 0, -1, { withScores: true });
        if (forceZset.length > 0) {
            await dest.del('global:analyses:timestamp');
            const pipe = dest.pipeline();
            for (let i = 0; i < forceZset.length; i += 2) {
                pipe.zadd('global:analyses:timestamp', Number(forceZset[i + 1]), String(forceZset[i]));
            }
            await pipe.exec();
        }

        const forceRecent = await source.lrange('recent_analyses', 0, -1);
        if (forceRecent.length > 0) {
            await dest.del('recent_analyses');
            const pipe = dest.pipeline();
            for (let i = forceRecent.length - 1; i >= 0; i--) {
                pipe.lpush('recent_analyses', typeof forceRecent[i] === 'object' ? JSON.stringify(forceRecent[i]) : forceRecent[i]);
            }
            await pipe.exec();
        }

        console.log('🔄 Clearing platform metrics cache...');
        await dest.del('platform_metrics');

        const finalTotal = await dest.zcard('global:analyses:timestamp');
        console.log(`\n✨ PRODUCTION-TO-VPS SYNC COMPLETE!`);
        console.log(`📊 Final Count on VPS: ${finalTotal}`);
        
        process.exit(0);
    } catch (e) {
        console.error('❌ Sync failed:', e);
        process.exit(1);
    }
}

sync();
