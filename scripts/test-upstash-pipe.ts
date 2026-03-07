import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function run() {
    console.log("Connecting to Upstash...", process.env.UPSTASH_REDIS_REST_KV_REST_API_URL);
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
        token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
    });

    const key = 'test:pipeline:list';
    
    // Setup list
    await redis.del(key);
    await redis.lpush(key, 'item1', 'item2', 'item3');
    
    console.log("Initial List Length:", await redis.llen(key)); // Expect 3

    // Pipeline test
    const p = redis.pipeline();
    p.del(key);
    p.lpush(key, 'newItem1', 'newItem2');
    await p.exec();

    console.log("Final List Length:", await redis.llen(key)); // Expect 2
    
    // Cleanup
    await redis.del(key);
}
run();
