
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function main() {
    const list = await redis.lrange('recent_analyses', 0, 10);
    console.log('Recent Tweets:');
    for (const item of list) {
        const p = typeof item === 'string' ? JSON.parse(item) : item;
        console.log(`${p.id} | ${p.symbol} | ${p.type} | ${p.username}`);
    }
}

main().catch(console.error);
