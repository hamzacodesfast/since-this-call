
import { Redis } from '@upstash/redis';
import { Redis as IORedis } from 'ioredis';
import * as dotenv from 'dotenv';
import path from 'path';

/**
 * super-sync.ts
 * 
 * The ultimate data reconciler. 
 * Instead of relying on the 'all_users' set, it scans the global index
 * to find every single username that ever made a call, then pulls their history.
 */

dotenv.config({ path: path.resolve(process.cwd(), '.env.production'), override: true });

const SOURCE_URL = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL || '';
const SOURCE_TOKEN = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN || '';
const DEST_URL = process.env.NEW_REDIS_URL || 'redis://localhost:6379';

if (!SOURCE_URL || !SOURCE_TOKEN) {
    console.error('❌ Upstash credentials missing. Check .env.production');
    process.exit(1);
}

async function superSync() {
    console.log('🔗 Connecting to Upstash (Source)...');
    const source = new Redis({ url: SOURCE_URL, token: SOURCE_TOKEN });

    console.log('🔗 Connecting to VPS Redis (Dest)...');
    const dest = new IORedis(DEST_URL);

    try {
        console.log('🚀 SEARCHING FOR ALL TRADES IN GLOBAL INDEX...');
        
        // 1. Get every trade reference (user:id) from the global index
        const globalRefs = await source.zrange('global:analyses:timestamp', 0, -1);
        console.log(`📊 Found ${globalRefs.length} trades in global index.`);

        // 2. Extract unique usernames
        const usersInIndex = new Set<string>();
        globalRefs.forEach(ref => {
            if (typeof ref === 'string') {
                const parts = ref.split(':');
                if (parts.length >= 2) usersInIndex.add(parts[0].toLowerCase());
            }
        });

        const usersFromAllUsers = await source.smembers('all_users');
        usersFromAllUsers.forEach(u => usersInIndex.add(u.toLowerCase()));

        const usernames = Array.from(usersInIndex);
        console.log(`👤 Found ${usernames.length} unique usernames involved in trades.`);

        // 3. Sync all users in the superset
        console.log(`🔄 Syncing data for ${usernames.length} users...`);
        let processed = 0;
        
        // Parallel chunks for speed
        const CHUNK_SIZE = 50;
        for (let i = 0; i < usernames.length; i += CHUNK_SIZE) {
            const chunk = usernames.slice(i, i + CHUNK_SIZE);
            
            await Promise.all(chunk.map(async (user) => {
                // Fetch from Source
                const [history, profile] = await Promise.all([
                    source.lrange(`user:history:${user}`, 0, -1),
                    source.hgetall(`user:profile:${user}`)
                ]);

                if (history.length === 0 && !profile) return;

                const pipe = dest.pipeline();
                
                // Ensure user is in the 'all_users' set
                pipe.sadd('all_users', user);

                // Rebuild History
                if (history.length > 0) {
                    pipe.del(`user:history:${user}`);
                    for (let j = history.length - 1; j >= 0; j--) {
                        const item = history[j];
                        pipe.lpush(`user:history:${user}`, typeof item === 'object' ? JSON.stringify(item) : item);
                    }
                }

                // Restore Profile
                if (profile) {
                    pipe.hset(`user:profile:${user}`, profile);
                }

                await pipe.exec();
            }));

            processed += chunk.length;
            if (processed % 500 === 0 || processed === usernames.length) {
                console.log(`   [Sync] Progress: ${processed}/${usernames.length} users...`);
            }
        }

        // 4. Sync Global Set memberships (Tickers)
        console.log('🔄 Syncing tracked_tickers set...');
        const tickers = await source.smembers('tracked_tickers');
        if (tickers.length > 0) {
            await dest.sadd('tracked_tickers', ...tickers);
        }

        // 5. Final check
        const destUsers = await dest.scard('all_users');
        console.log(`\n✨ SUPER SYNC COMPLETE!`);
        console.log(`✅ Total Users on VPS: ${destUsers}`);
        console.log('👉 Now run rebuild-indices.ts on the server to finish.');
        
        process.exit(0);

    } catch (e) {
        console.error('❌ Super Sync failed:', e);
        process.exit(1);
    }
}

superSync();
