// Script to list all tweet IDs in Redis
// Run with: npx -y tsx scripts/list-tweets.ts

import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const RECENT_KEY = 'recent_analyses';

async function listTweets() {
    const allItems = await redis.lrange(RECENT_KEY, 0, -1);
    console.log(`Found ${allItems.length} items:\n`);

    allItems.forEach((item: any, index: number) => {
        const parsed = typeof item === 'string' ? JSON.parse(item) : item;
        console.log(`${index + 1}. ID: ${parsed.id} | Symbol: ${parsed.symbol} | User: @${parsed.username}`);
    });
}

listTweets().catch(console.error);
