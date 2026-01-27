
import * as dotenv from 'dotenv';
import * as path from 'path';
import { getRedisClient } from '../src/lib/redis-client';
import { recalculateUserProfile } from '../src/lib/analysis-store';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Force local-only
delete process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL;
delete process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

async function removeBatch() {
    const tweetIds = process.argv.slice(2);

    if (tweetIds.length === 0) {
        console.error('❌ Usage: npx tsx scripts/remove-batch.ts <TWEET_ID_1> <TWEET_ID_2> ...');
        process.exit(1);
    }

    const redis = getRedisClient();
    const affectedUsers = new Set<string>();

    for (const tweetId of tweetIds) {
        console.log(`🗑️ Processing removal for Tweet ${tweetId}...`);

        // 1. Remove from Global Recent List (recent_analyses)
        const recentKey = 'recent_analyses';
        const analyses = await redis.lrange(recentKey, 0, -1);
        const newRecent = analyses.filter((item: any) => {
            const p = typeof item === 'string' ? JSON.parse(item) : item;
            if (p.id === tweetId) {
                affectedUsers.add(p.username.toLowerCase());
                return false;
            }
            return true;
        });

        if (newRecent.length < analyses.length) {
            await redis.del(recentKey);
            if (newRecent.length > 0) {
                // Push as strings to match Upstash behavior
                const toPush = newRecent.map(i => typeof i === 'string' ? i : JSON.stringify(i));
                await redis.rpush(recentKey, ...toPush);
            }
            console.log(` ✅ Removed ${tweetId} from Global Recent list.`);
        }

        // 2. Scan all user histories just in case it wasn't in recent_analyses or we don't know the user
        const allUsers = await redis.smembers('all_users');
        for (const user of allUsers) {
            const historyKey = `user:history:${user}`;
            const history = await redis.lrange(historyKey, 0, -1);
            const newHistory = history.filter((item: any) => {
                const p = typeof item === 'string' ? JSON.parse(item) : item;
                return p.id !== tweetId;
            });

            if (newHistory.length < history.length) {
                await redis.del(historyKey);
                if (newHistory.length > 0) {
                    const toPush = newHistory.map(i => typeof i === 'string' ? i : JSON.stringify(i));
                    await redis.rpush(historyKey, ...toPush);
                }
                console.log(` ✅ Removed ${tweetId} from @${user}'s history.`);
                affectedUsers.add(user);
            }
        }
    }

    // 3. Recalculate profiles for all affected users
    for (const user of affectedUsers) {
        console.log(`📊 Recalculating profile for @${user}...`);
        await recalculateUserProfile(user);
    }

    console.log('\n✨ Batch removal complete.');
    process.exit(0);
}

removeBatch();
