import { getRedisClient } from '../src/lib/redis-client';
import { dualWrite } from '../src/lib/analysis-store';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
    try {
        const redis = getRedisClient();
        const key = 'test:dualpipe:list';

        await redis.del(key);
        await redis.lpush(key, 'a', 'b', 'c', 'd', 'e');
        const initial = await redis.llen(key);
        console.log("Initial List Length:", initial);

        console.log("Running dualWrite pipeline...");
        await dualWrite(async (r) => {
            const pipe = r.pipeline();
            pipe.del(key);
            pipe.lpush(key, '1');
            pipe.lpush(key, '2');
            await pipe.exec();
        });

        const verify1 = await redis.llen(key);
        console.log("After dualWrite:", verify1);

        console.log("Running second dualWrite...");
        await dualWrite(async (r) => {
            await r.hset(key + "_profile", { "ok": 1 });
        });

        const verify2 = await redis.llen(key);
        console.log("After second dualWrite:", verify2);

    } catch (e) {
        console.error("Test Error:", e);
    }
    process.exit(0);
}
run();
