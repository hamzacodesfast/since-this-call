
import { Redis } from '@upstash/redis';
import { Redis as IORedis } from 'ioredis';
import * as dotenv from 'dotenv';
import path from 'path';

/**
 * sync-to-vps.ts
 * 
 * Robust sync from Upstash to VPS Redis.
 */

dotenv.config({ path: path.resolve(process.cwd(), '.env.production'), override: true });

const SOURCE_URL = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL || '';
const SOURCE_TOKEN = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN || '';
const DEST_URL = process.env.NEW_REDIS_URL || 'redis://localhost:6379';

if (!SOURCE_URL || !SOURCE_TOKEN) {
    console.error('❌ Upstash credentials missing');
    process.exit(1);
}

async function sync() {
    console.log('🔗 Connecting to Upstash (Source)...');
    const source = new Redis({ url: SOURCE_URL, token: SOURCE_TOKEN });

    console.log('🔗 Connecting to VPS Redis (Dest)...');
    const dest = new IORedis(DEST_URL);

    try {
        // 1. Sync all_users
        console.log('🔄 Syncing all_users set...');
        const users = await source.smembers('all_users');
        if (users.length > 0) {
            await dest.sadd('all_users', ...users);
        }
        console.log(`   ✅ Synced ${users.length} users in all_users.`);

        // 2. Sync user histories (The most important part)
        console.log('🔄 Syncing user histories and profiles...');
        let processed = 0;
        
        // We'll process sequentially to be totally safe against rate limits/timeouts
        for (const user of users) {
            const history = await source.lrange(`user:history:${user}`, 0, -1);
            const profile = await source.hgetall(`user:profile:${user}`);

            const pipe = dest.pipeline();
            
            // Clear and rebuild history to ensure perfect match
            if (history.length > 0) {
                pipe.del(`user:history:${user}`);
                // Lrange returns newest first. To preserve with LPUSH, push oldest first.
                for (let i = history.length - 1; i >= 0; i--) {
                    const item = history[i];
                    pipe.lpush(`user:history:${user}`, typeof item === 'object' ? JSON.stringify(item) : item);
                }
            }

            if (profile) {
                pipe.hset(`user:profile:${user}`, profile);
            }

            await pipe.exec();
            processed++;
            
            if (processed % 500 === 0) {
                console.log(`   Processed ${processed}/${users.length} users history...`);
            }
        }

        // 3. Sync recent_analyses
        console.log('🔄 Syncing recent_analyses list...');
        const recent = await source.lrange('recent_analyses', 0, -1);
        if (recent.length > 0) {
            await dest.del('recent_analyses');
            const pipe = dest.pipeline();
            for (let i = recent.length - 1; i >= 0; i--) {
                const item = recent[i];
                pipe.lpush('recent_analyses', typeof item === 'object' ? JSON.stringify(item) : item);
            }
            await pipe.exec();
        }

        // 4. Final verification: Check total analyses on Source vs Dest
        const sourceTotal = await source.zcard('global:analyses:timestamp');
        console.log(`\n📊 Upstash Global Index: ${sourceTotal}`);
        console.log('   Run rebuild-indices.ts on the server after this script to match this number.');

        console.log('\n✨ SYNC TO VPS COMPLETE!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Sync failed:', e);
        process.exit(1);
    }
}

sync();
