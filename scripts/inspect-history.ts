
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function inspect() {
    const key = 'user:history:jimcramer';
    const data = await redis.lrange(key, 0, -1);
    console.log(`Key: ${key}`);
    console.log(`Count: ${data.length}`);
    data.forEach((item: any, i) => {
        const p = typeof item === 'string' ? JSON.parse(item) : item;
        console.log(`[${i}] ID: ${p.id} | Symbol: ${p.symbol} | Time: ${p.timestamp}`);
    });
}

inspect();
