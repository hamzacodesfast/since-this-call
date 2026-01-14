// Script to remove specific tweets from Redis
// Run with: npx -y tsx scripts/cleanup.ts

import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const RECENT_KEY = 'recent_analyses';

// Tweets to remove
const BAD_TWEET_IDS = [
    '2011253892592357470', // @druss113 - $dog lowcap coin misidentified
    '2004218883092500890', // @cryptopop_ath - pumpfun CA
    '2011252741792764397', // @milerozu - random babbling
];

async function cleanup() {
    console.log('Fetching all analyses...');
    const allItems = await redis.lrange(RECENT_KEY, 0, -1);
    console.log(`Found ${allItems.length} items`);

    const filtered: any[] = [];
    let removedCount = 0;

    for (const item of allItems) {
        const parsed = typeof item === 'string' ? JSON.parse(item) : item;

        if (BAD_TWEET_IDS.includes(parsed.id)) {
            console.log(`Removing: ${parsed.id} (${parsed.symbol}) by @${parsed.username}`);
            removedCount++;
            continue;
        }

        filtered.push(item);
    }

    console.log(`\nRemoving ${removedCount} tweets`);
    console.log(`Keeping ${filtered.length} items`);

    if (filtered.length < allItems.length) {
        await redis.del(RECENT_KEY);
        if (filtered.length > 0) {
            for (const item of filtered.reverse()) {
                await redis.lpush(RECENT_KEY, typeof item === 'string' ? item : JSON.stringify(item));
            }
        }
        console.log('\n✅ Cleanup complete!');
    } else {
        console.log('No matching tweets found.');
    }
}

cleanup().catch(console.error);
