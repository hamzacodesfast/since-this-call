import { getRedisClient } from '../src/lib/redis-client';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
    const redis = getRedisClient();
    await redis.pipeline().set('testkey', 'value').exec();
    console.log("Initial", await redis.get('testkey'));
    const p = redis.pipeline();
    p.del('testkey');
    p.set('testkey', 'newvalue');
    await p.exec();
    console.log("Final", await redis.get('testkey'));
    process.exit(0);
}
run();
