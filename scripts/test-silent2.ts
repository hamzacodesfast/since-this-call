import { getRedisClient } from '../src/lib/redis-client';
async function run() {
    const redis = getRedisClient();
    const key = 'test:silent2';
    await redis.del(key);
    const pipe = redis.pipeline();
    pipe.del(key);
    pipe.lpush(key, 'v1');
    pipe.lpush(key, 'v2');
    console.log(await pipe.exec());
    console.log(await redis.llen(key));
    process.exit(0);
}
run();
