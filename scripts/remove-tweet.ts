
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars BEFORE importing modules that use them
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const tweetId = process.argv[2];
    const username = process.argv[3];

    if (!tweetId || !username) {
        console.error('❌ Usage: npx tsx scripts/remove-tweet.ts <TWEET_ID> <USERNAME>');
        process.exit(1);
    }

    // Dynamic import to ensure process.env is ready
    const { getRedisClient } = await import('../src/lib/redis-client');
    const { untrackTicker, recalculateUserProfile } = await import('../src/lib/analysis-store');

    const redis = getRedisClient();
    console.log(`🔌 Connected to Redis (Local mode: ${!process.env.UPSTASH_REDIS_REST_KV_REST_API_URL})`);

    // 1. Remove from User History
    const historyKey = `user:history:${username.toLowerCase()}`;
    const history = await redis.lrange(historyKey, 0, -1);
    let targetAnalysis: any = null;

    console.log(`🔍 Searching ${history.length} items in ${historyKey}...`);

    const newHistory = history.filter((item: any) => {
        const p = typeof item === 'string' ? JSON.parse(item) : item;
        if (p.id === tweetId) {
            targetAnalysis = p;
            return false;
        }
        return true;
    });

    if (targetAnalysis) {
        console.log(`✅ Found tweet. Removing...`);

        // Untrack ticker to clean up indices
        await untrackTicker(targetAnalysis);
        console.log(`- Untracked ticker ${targetAnalysis.ticker || targetAnalysis.symbol}`);

        // Rewrite history
        await redis.del(historyKey);

        // Push back (preserve order: filtered list is [Newest...Oldest] ?? lrange gives 0..-1. 
        // lrange 0 is head. list[0] is head.
        // lpush pushes to head.
        // So allow me to explain:
        // List: [A, B, C] (A is head/newest)
        // lrange gives [A, B, C]
        // If we iterate A, B, C and lpush...
        // 1. push A -> [A]
        // 2. push B -> [B, A]
        // 3. push C -> [C, B, A]
        // Result: C is head (newest). REVERSED!
        // So we must iterate in REVERSE to preserve order.

        if (newHistory.length > 0) {
            for (let i = newHistory.length - 1; i >= 0; i--) {
                const item = newHistory[i];
                await redis.lpush(historyKey, typeof item === 'string' ? item : JSON.stringify(item));
            }
        }

        console.log(`- Updated ${historyKey}`);

        // Recalculate Stats
        console.log(`- Recalculating stats for ${username}...`);
        await recalculateUserProfile(username);
        console.log(`✅ Stats updated.`);

    } else {
        console.log(`⚠️ Tweet ${tweetId} not found in ${historyKey}.`);
    }

    // 2. Remove from Recent Analyses
    const recentKey = 'recent_analyses';
    const recent = await redis.lrange(recentKey, 0, -1);
    const newRecent = recent.filter((item: any) => {
        const p = typeof item === 'string' ? JSON.parse(item) : item;
        return p.id !== tweetId;
    });

    if (newRecent.length < recent.length) {
        await redis.del(recentKey);
        // Same reverse logic
        if (newRecent.length > 0) {
            for (let i = newRecent.length - 1; i >= 0; i--) {
                const item = newRecent[i];
                await redis.lpush(recentKey, typeof item === 'string' ? item : JSON.stringify(item));
            }
        }
        console.log(`✅ Removed from ${recentKey}`);
    } else {
        console.log(`ℹ️ Tweet not found in recent_analyses (might be old).`);
    }

    console.log('🎉 Done.');
    process.exit(0);
}

main();
