
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Hardcode fallback just in case
if (!process.env.UPSTASH_REDIS_REST_KV_REST_API_URL) {
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL = "redis://localhost:6379";
}

async function verifyTweet() {
    const { getRedisClient } = await import('../src/lib/redis-client');
    const redis = getRedisClient();

    // Tweet ID provided by user
    const tweetId = '2011108474701402581';

    console.log(`🔍 Inspecting MSTR Tweet ${tweetId}...`);

    // 1. Check Recent Analyses
    const recent = await redis.lrange('recent_analyses', 0, -1);
    const foundRecent = recent.map((s: any) => typeof s === 'string' ? JSON.parse(s) : s).find((a: any) => a.id === tweetId);

    if (foundRecent) {
        console.log('\n[Recent Analyses List]:');
        console.log(JSON.stringify(foundRecent, null, 2));
    } else {
        console.log('\n❌ Not found in recent_analyses');
    }

    // 2. Check User History
    // Username is likely GarrettBullish based on previous logs
    const username = foundRecent?.username || 'GarrettBullish';
    const historyKey = `user:history:${username.toLowerCase()}`;
    const history = await redis.lrange(historyKey, 0, -1);
    const foundHistory = history.map((s: any) => typeof s === 'string' ? JSON.parse(s) : s).find((a: any) => a.id === tweetId);

    if (foundHistory) {
        console.log(`\n[User History (${username})]:`);
        console.log(JSON.stringify(foundHistory, null, 2));
    } else {
        console.log(`\n❌ Not found in user history for ${username}`);
    }

    process.exit(0);
}

verifyTweet();
