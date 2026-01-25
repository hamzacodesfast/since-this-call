
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Prod Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function forceUpdate() {
    console.log('🔧 Force Updating Tweet 2011108474701402581...');

    // Dynamic Import
    const { getRedisClient } = await import('../src/lib/redis-client');
    const redis = getRedisClient();

    const tweetId = '2011108474701402581';
    const username = 'garrettbullish'; // key is lowercase

    // 1. Update Recent Analyses
    const recentRaw = await redis.lrange('recent_analyses', 0, -1);
    const recent = recentRaw.map((s: any) => typeof s === 'string' ? JSON.parse(s) : s);

    let updated = false;
    const newRecent = recent.map((item: any) => {
        if (item.id === tweetId) {
            console.log('Found in Recent. Updating...');
            updated = true;
            return {
                ...item,
                sentiment: 'BULLISH',
                performance: -2.737, // Hardcoded for precision based on 163.11/167.70
                isWin: false
            };
        }
        return item;
    });

    if (updated) {
        await redis.del('recent_analyses');
        const pipe = redis.pipeline();
        // Preserving order (recent is Newest First)
        // Correct way to rebuild list: RPUSH iterables.
        // Wait, lrange 0 -1 gives [Newest, ..., Oldest]
        // RPUSH appends to tail.
        // So RPUSH [Newest] -> List: [Newest]
        // RPUSH [Next] -> List: [Newest, Next]
        // This preserves order.
        for (const item of newRecent) {
            pipe.rpush('recent_analyses', JSON.stringify(item));
        }
        await pipe.exec();
        console.log('✅ Updated Recent Analyses.');
    }

    // 2. Update User History
    const historyKey = `user:history:${username}`;
    const historyRaw = await redis.lrange(historyKey, 0, -1);
    const history = historyRaw.map((s: any) => typeof s === 'string' ? JSON.parse(s) : s);

    let histUpdated = false;
    const newHistory = history.map((item: any) => {
        if (item.id === tweetId) {
            console.log('Found in History. Updating...');
            histUpdated = true;
            return {
                ...item,
                sentiment: 'BULLISH',
                performance: -2.737,
                isWin: false
            };
        }
        return item;
    });

    if (histUpdated) {
        await redis.del(historyKey);
        const pipe = redis.pipeline();
        for (const item of newHistory) {
            pipe.rpush(historyKey, JSON.stringify(item));
        }
        await pipe.exec();
        console.log('✅ Updated User History.');

        // Recalculate Profile Stats
        const { recalculateUserProfile } = await import('../src/lib/analysis-store');
        await recalculateUserProfile(username); // Note: this uses dualWrite but we are targeting prod directly via env vars, so redis-client is forced to prod. recalculateUserProfile uses getRedisClient().
    }

    process.exit(0);
}

forceUpdate();
