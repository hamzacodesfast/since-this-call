
import * as dotenv from 'dotenv';
import * as path from 'path';

// Fix Env (Prod First)
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
if (!process.env.UPSTASH_REDIS_REST_KV_REST_API_URL) {
    // Fallback? No, strict Prod per protocol.
    console.warn('⚠️ PROD Key missing! Using .env.local as fallback (ONLY IF YOU KNOW WHAT YOU ARE DOING)');
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}

async function fixTimestamps() {
    console.log('🕰️  Fixing Timestamps (Main First)...');

    const { getRedisClient } = await import('../src/lib/redis-client');
    const { analyzeTweet } = await import('../src/lib/analyzer');
    // We need to update user profile history AND recent list

    const redis = getRedisClient();

    // 1. Get All Users to scan everyone
    const users = await redis.smembers('all_users');
    console.log(`Found ${users.length} users.`);

    let totalFixed = 0;

    for (const user of users) {
        if (typeof user !== 'string') continue;
        const historyKey = `user:history:${user.toLowerCase()}`;

        const historyRaw = await redis.lrange(historyKey, 0, -1);
        const history = historyRaw.map((s: any) => typeof s === 'string' ? JSON.parse(s) : s);

        let userUpdated = false;

        // Prioritize reported user, skip others to save API calls if high volume
        // Or check top 5 for everyone
        const shouldDeepScan = user === 'peterlbrandt' || user === 'garrettbullish'; // Add suspect users
        const scanLimit = shouldDeepScan ? 100 : 1;

        for (const item of history.slice(0, scanLimit)) {
            try {
                // Always re-fetch for suspect users to verify
                // This is the only way since we lost the original date source
                if (!shouldDeepScan) continue;

                const fresh = await analyzeTweet(item.id);
                const realTime = new Date(fresh.tweet.date).getTime();
                const storedTime = item.timestamp;

                // If diff > 1 hour, update it
                if (Math.abs(realTime - storedTime) > 1000 * 60 * 60) {
                    console.log(`    ✅ Fixing ${user}/${item.symbol}: ${storedTime} -> ${realTime}`);
                    item.timestamp = realTime;
                    userUpdated = true;
                    totalFixed++;
                }

            } catch (e) {
                console.error(`    ❌ Failed to fetch tweet ${item.id}:`, e);
            }
        }

        if (userUpdated) {
            console.log(`💾 Saving updates for ${user}...`);
            await redis.del(historyKey);
            const pipe = redis.pipeline();
            // Re-store in same order (assuming history list is 0=Newest)
            // history array we iterated is [Newest...Oldest]
            // So we loop backwards to LPUSH (or just RPUSH if we del)
            // Actually, lrange 0 -1 returns Newest ... Oldest.
            // So to reconstruct list `user:history:x` (which is a LIST), if we RPUSH, we get [Newest, ..., Oldest].
            // Yes.
            for (const item of history) {
                pipe.rpush(historyKey, JSON.stringify(item));
            }
            await pipe.exec();

            // Also update Profile Stats Recalculation just in case (date changes lastAnalyzed logic?)
            // lastAnalyzed is `top` item timestamp?
            // recalculateUserProfile logic: `lastAnalyzed: Date.now()` (Wait, Step 315 line 418 use Date.now()!)

            // Wait!!!!
            // `recalculateUserProfile` sets `lastAnalyzed: Date.now()`.
            // User Profile `lastAnalyzed` field in UI might be showing "Last Search Time" not "Last Tweet Time".
            // But the user complained about "showing timestamp of search instead of tweet" on the PROFILE PAGE entries?
            // The entries come from `history`.

            // So fixing `history` is correct.
        }
    }

    // Also fix Global Recent Analyses
    console.log('🔄 Checking Global Recent List...');
    const recentKey = 'recent_analyses';
    const recentRaw = await redis.lrange(recentKey, 0, -1);
    const recent = recentRaw.map((s: any) => typeof s === 'string' ? JSON.parse(s) : s);
    let recentUpdated = false;

    for (const item of recent) {
        if (!item.date) continue;
        const analysisTime = new Date(item.date).getTime();
        const storedTime = item.timestamp;
        const diffHours = Math.abs(storedTime - analysisTime) / (1000 * 60 * 60);

        if (diffHours > 24) {
            // Check if we already fixed it in user history?
            // Easier to just re-fetch to be safe/consistent.
            try {
                const fresh = await analyzeTweet(item.id);
                const realTime = new Date(fresh.tweet.date).getTime();

                if (Math.abs(realTime - storedTime) > 1000 * 60 * 60) {
                    console.log(`    ✅ Fixing Global ${item.symbol} (${item.id})`);
                    item.timestamp = realTime;
                    recentUpdated = true;
                }
            } catch (e) { }
        }
    }

    if (recentUpdated) {
        console.log('💾 Saving Global Recent List...');
        await redis.del(recentKey);
        const pipe = redis.pipeline();
        for (const item of recent) {
            pipe.rpush(recentKey, JSON.stringify(item));
        }
        await pipe.exec();
    }

    console.log(`\n✨ Scan complete. Fixed ${totalFixed} timestamps.`);
    process.exit(0);
}

fixTimestamps();
