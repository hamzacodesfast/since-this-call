
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Prod Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

// Verify Env Loaded
console.log('Checking URL:', process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ? 'Loaded' : 'Missing');

async function verifyTweetProd() {
    const { getRedisClient } = await import('../src/lib/redis-client');
    const redis = getRedisClient();

    // Tweet ID provided by user
    const tweetId = '2011108474701402581';

    console.log(`🔍 Inspecting MSTR Tweet ${tweetId} on PRODUCTION...`);

    // 1. Check Recent Analyses
    const recent = await redis.lrange('recent_analyses', 0, -1);
    const foundRecent = recent.map((s: any) => typeof s === 'string' ? JSON.parse(s) : s).find((a: any) => a.id === tweetId);

    if (foundRecent) {
        console.log('\n[Recent Analyses List]:');
        console.log(JSON.stringify(foundRecent, null, 2));
    } else {
        console.log('\n❌ Not found in recent_analyses');
    }

    process.exit(0);
}

verifyTweetProd();
