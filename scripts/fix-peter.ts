
import * as dotenv from 'dotenv';
import * as path from 'path';

// Fix Env (Prod First)
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function fixPeterOnly() {
    console.log('🕰️  Fixing PeterLBrandt Immediately...');

    const { getRedisClient } = await import('../src/lib/redis-client');
    const { analyzeTweet } = await import('../src/lib/analyzer');

    const redis = getRedisClient();
    const user = 'peterlbrandt';
    const historyKey = `user:history:${user}`;

    const historyRaw = await redis.lrange(historyKey, 0, -1);
    const history = historyRaw.map((s: any) => typeof s === 'string' ? JSON.parse(s) : s);

    let userUpdated = false;

    for (const item of history) {
        try {
            console.log(`Checking ${item.id} (${item.symbol})...`);
            const fresh = await analyzeTweet(item.id);
            const realTime = new Date(fresh.tweet.date).getTime();
            const storedTime = item.timestamp;

            // If diff > 1 hour, update it
            if (Math.abs(realTime - storedTime) > 1000 * 60 * 60) {
                console.log(`    ✅ Fixing ${item.symbol}: ${storedTime} -> ${realTime}`);
                item.timestamp = realTime;
                userUpdated = true;
            } else {
                console.log(`    👌 OK.`);
            }

        } catch (e) {
            console.error(`    ❌ Failed to fetch tweet ${item.id}:`, e);
        }
    }

    if (userUpdated) {
        console.log(`💾 Saving updates for ${user}...`);
        await redis.del(historyKey);
        const pipe = redis.pipeline();
        for (const item of history) {
            pipe.rpush(historyKey, JSON.stringify(item));
        }
        await pipe.exec();

        // Also update Profile
        const { recalculateUserProfile } = await import('../src/lib/analysis-store');
        await recalculateUserProfile(user);
    }

    console.log('Done.');
    process.exit(0);
}

fixPeterOnly();
