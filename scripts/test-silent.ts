import { getRedisClient } from '../src/lib/redis-client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
    const redis = getRedisClient();
    const key = 'test:silent';
    
    await redis.del(key);
    
    // Test native pipeline via wrapper
    const pipe = redis.pipeline();
    pipe.lpush(key, 'value');
    console.log("exec type:", typeof pipe.exec);
    
    try {
        const res = await pipe.exec();
        console.log("Exec result:", res);
    } catch(e) {
        console.error("Exec threw:", e);
    }
    
    console.log("List size:", await redis.llen(key));
    process.exit(0);
}
run();
