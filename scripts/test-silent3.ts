import { getRedisClient } from '../src/lib/redis-client';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function myDualWrite(fn) {
    const redis = getRedisClient();
    await fn(redis);
}

async function run() {
    const redis = getRedisClient();
    const key = 'test:silent3';
    await redis.del(key);
    await redis.lpush(key, 'old');
    
    await myDualWrite(async (r) => {
        const pipe = r.pipeline();
        pipe.del(key);
        pipe.lpush(key, 'new');
        await pipe.exec();
    });
    
    console.log(await redis.llen(key));
    process.exit(0);
}
run();
