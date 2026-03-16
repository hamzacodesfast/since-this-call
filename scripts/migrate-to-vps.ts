
import { Redis } from '@upstash/redis';
import { Redis as IORedis } from 'ioredis';
import * as dotenv from 'dotenv';
import path from 'path';

/**
 * migrate-to-vps.ts
 * 
 * Usage:
 * 1. Set NEW_REDIS_URL in your environment or a temporary .env file.
 * 2. Run: npx tsx scripts/migrate-to-vps.ts
 */

dotenv.config({ path: path.resolve(process.cwd(), '.env.production'), override: true });

const SOURCE_URL = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const SOURCE_TOKEN = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

// REPLACE THIS with your new VPS Redis URL (e.g., redis://default:password@your-vps-ip:6379)
const DEST_URL = process.env.NEW_REDIS_URL || 'redis://localhost:6379';

if (!SOURCE_URL || !SOURCE_TOKEN) {
    console.error('❌ Source (Upstash) credentials missing in .env.production');
    process.exit(1);
}

async function migrate() {
    console.log('🔗 Connecting to Source (Upstash)...');
    const source = new Redis({ url: SOURCE_URL, token: SOURCE_TOKEN });

    console.log('🔗 Connecting to Destination (VPS Redis)...');
    const dest = new IORedis(DEST_URL);

    try {
        console.log('🚀 Starting Migration...');

        // 1. Sync Global Sets
        const globalSets = ['all_users', 'tracked_tickers'];
        for (const set of globalSets) {
            console.log(` - Migrating set: ${set}`);
            const members = await source.smembers(set);
            if (members.length > 0) {
                await dest.sadd(set, ...members);
            }
        }

        // 2. Sync Global ZSets
        const globalZSets = ['global:analyses:timestamp', 'recent_analyses']; // Note: recent_analyses is a LIST in your app
        
        console.log(' - Migrating list: recent_analyses');
        const recent = await source.lrange('recent_analyses', 0, -1);
        if (recent.length > 0) {
            await dest.del('recent_analyses');
            const pipe = dest.pipeline();
            for (const item of recent.reverse()) {
                pipe.lpush('recent_analyses', typeof item === 'object' ? JSON.stringify(item) : item);
            }
            await pipe.exec();
        }

        console.log(' - Migrating ZSET: global:analyses:timestamp');
        const globalIndex = await source.zrange('global:analyses:timestamp', 0, -1, { withScores: true });
        if (globalIndex.length > 0) {
            const pipe = dest.pipeline();
            for (let i = 0; i < globalIndex.length; i += 2) {
                pipe.zadd('global:analyses:timestamp', Number(globalIndex[i+1]), String(globalIndex[i]));
            }
            await pipe.exec();
        }

        // 3. User Data (Profiles + History)
        const users = await source.smembers('all_users');
        console.log(` - Migrating data for ${users.length} users...`);

        const CHUNK_SIZE = 100;
        for (let i = 0; i < users.length; i += CHUNK_SIZE) {
            const chunk = users.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async (user) => {
                const pipe = dest.pipeline();
                
                // Profile
                const profile = await source.hgetall(`user:profile:${user}`);
                if (profile) pipe.hset(`user:profile:${user}`, profile);

                // History
                const history = await source.lrange(`user:history:${user}`, 0, -1);
                if (history.length > 0) {
                    pipe.del(`user:history:${user}`);
                    for (const h of history.reverse()) {
                        pipe.lpush(`user:history:${user}`, typeof h === 'object' ? JSON.stringify(h) : h);
                    }
                }
                
                await pipe.exec();
            }));
            console.log(`   [Users] ${i + chunk.length}/${users.length} completed.`);
        }

        // 4. Ticker Data
        const tickers = await source.smembers('tracked_tickers');
        console.log(` - Migrating data for ${tickers.length} tickers...`);
        for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
            const chunk = tickers.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async (ticker) => {
                const pipe = dest.pipeline();
                
                // Profile
                const profile = await source.hgetall(`ticker:profile:${ticker}`);
                if (profile) pipe.hset(`ticker:profile:${ticker}`, profile);

                // Index
                const index = await source.zrange(`ticker_index:${ticker}`, 0, -1, { withScores: true });
                if (index.length > 0) {
                    pipe.del(`ticker_index:${ticker}`);
                    for (let j = 0; j < index.length; j += 2) {
                        pipe.zadd(`ticker_index:${ticker}`, Number(index[j+1]), String(index[j]));
                    }
                }
                
                await pipe.exec();
            }));
            console.log(`   [Tickers] ${i + chunk.length}/${tickers.length} completed.`);
        }

        console.log('\n✨ MIGRATION COMPLETE!');
        process.exit(0);

    } catch (e) {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    }
}

migrate();
