
import dotenv from 'dotenv';
import path from 'path';
import { Redis } from '@upstash/redis';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function run() {
    const ids = ['2014164611537264681', '2014459604185579733', '2014461421317456155'];
    for (const id of ids) {
        const r = await redis.lrange('recent_analyses', 0, -1);
        const fr = r.find(i => JSON.stringify(i).includes(id));
        console.log(`ID ${id} in Recent: ${!!fr}`);

        const h1 = await redis.lrange('user:history:dekmartrades', 0, -1);
        console.log(`ID ${id} in @DekmarTrades: ${h1.some(i => JSON.stringify(i).includes(id))}`);

        const h2 = await redis.lrange('user:history:incomesharks', 0, -1);
        console.log(`ID ${id} in @IncomeSharks: ${h2.some(i => JSON.stringify(i).includes(id))}`);
    }
}

run().catch(console.error);
