import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function run() {
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
        token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
    });

    const key = 'test:immutable';
    await redis.del(key);
    await redis.lpush(key, 'a', 'b', 'c');

    // Test 1: Unchained
    const pipe1 = redis.pipeline();
    pipe1.del(key);
    pipe1.lpush(key, '1');
    await pipe1.exec();
    console.log("Unchained:", await redis.llen(key)); // If immutable, this will be 3!

    // Test 2: Chained
    const pipe2 = redis.pipeline();
    pipe2.del(key).lpush(key, '2').exec();
    // Wait, let's await it
    await pipe2.exec(); // wait, .exec() is what we usually await, but if we chained it we'd do await redis.pipeline()...exec()
    
    await redis.pipeline().del(key).lpush(key, 'chain1', 'chain2').exec();
    console.log("Chained:", await redis.llen(key)); // Expect 2
    
    process.exit(0);
}
run();
