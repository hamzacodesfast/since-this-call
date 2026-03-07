import { getRedisClient } from '../src/lib/redis-client';
import { dualWrite } from '../src/lib/analysis-store';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
    const redis = getRedisClient();
    const key = 'test:dualpipe';

    await redis.del(key);
    await redis.lpush(key, 'a', 'b', 'c', 'd', 'e');
    const initial = await redis.llen(key);
    console.log("Initial List Length:", initial);

    await dualWrite(async (r) => {
        const pipe = r.pipeline();
        pipe.del(key);
        pipe.lpush(key, '1');
        pipe.lpush(key, '2');
        await pipe.exec();
    });

    const verify1 = await redis.llen(key);
    console.log("After dualWrite:", verify1);

    await dualWrite(async (r) => {
        await r.hset(key + "_profile", { "ok": 1 });
    });

    const verify2 = await redis.llen(key);
    console.log("After recalc:", verify2);

    process.exit(0);
}
run();
