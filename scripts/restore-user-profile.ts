import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const redis = new Redis({
    url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function restore(username: string) {
    const lowerUser = username.toLowerCase();

    // 1. Get what's currently there (100 items)
    const historyKey = `user:history:${lowerUser}`;
    const historyData = await redis.lrange(historyKey, 0, -1);
    const existingIds = new Set(
        historyData.map((item: any) => (typeof item === 'string' ? JSON.parse(item) : item).id)
    );
    console.log(`Current items in ${historyKey}: ${existingIds.size}`);

    // 2. Get all target IDs from user_index
    const allRefsString = await redis.zrange(`user_index:${lowerUser}`, 0, -1) as string[];
    // refs are "<username>:<id>"
    const targetIds = allRefsString.map(ref => ref.split(':')[1]);
    console.log(`Expected items from ZSET: ${targetIds.length}`);

    const missingIds = targetIds.filter(id => !existingIds.has(id));
    console.log(`Missing items: ${missingIds.length}`);

    if (missingIds.length === 0) {
        console.log("Nothing to restore.");
        return;
    }

    // 3. Let's see if we can find them in recent_analyses
    console.log("Scanning recent_analyses (1000 items) for missing items...");
    const recentData = await redis.lrange('recent_analyses', 0, -1);
    const recentAnalyses = recentData.map((item: any) =>
        typeof item === 'string' ? JSON.parse(item) : item
    );

    const foundInRecent = new Map<string, any>();
    for (const a of recentAnalyses) {
        if (a.username.toLowerCase() === lowerUser && missingIds.includes(a.id)) {
            foundInRecent.set(a.id, a);
        }
    }
    console.log(`Recovered ${foundInRecent.size} items from recent_analyses cache!`);

    // 4. Try to stitch them back
    // We want the final history array to be sorted properly by timestamp (descending).
    // So we'll gather all available JSONs, sort them, and overwrite user:history

    const allKnownItems: any[] = [];

    // Add existing
    historyData.forEach((item: any) => {
        allKnownItems.push(typeof item === 'string' ? JSON.parse(item) : item);
    });

    // Add recovered
    foundInRecent.forEach(item => {
        allKnownItems.push(item);
    });

    // Sort descending by timestamp
    allKnownItems.sort((a, b) => b.timestamp - a.timestamp);

    console.log(`Total sorted items to save: ${allKnownItems.length}`);

    // Only save if we actually found something missing
    if (foundInRecent.size > 0) {
        await redis.del(historyKey);
        const pipeline = redis.pipeline();
        // rpush from oldest to newest OR lpush from newest to oldest?
        // Wait, lrange 0 -1 returns newest first. 
        // lpush pushes to the left (index 0). 
        // If we iterate array backwards and lpush, newest will end up at 0.
        for (let i = allKnownItems.length - 1; i >= 0; i--) {
            pipeline.lpush(historyKey, JSON.stringify(allKnownItems[i]));
        }
        await pipeline.exec();
        console.log(`Successfully patched ${historyKey} with ${allKnownItems.length} items!`);
    }
    process.exit(0);
}

restore('theskayeth').catch(console.error);
