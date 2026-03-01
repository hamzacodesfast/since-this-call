import { getRedisClient } from '../src/lib/redis-client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.production.local' });

const redis = getRedisClient();

async function run() {
    const historyData = await redis.lrange('user:history:stcquantagent', 0, -1);
    const history = historyData.map((d: any) => typeof d === 'string' ? JSON.parse(d) : d);

    console.log(`Total items: ${history.length}`);
    for (const h of history) {
        console.log(`- Symbol: ${h.symbol} | Text: ${h.text ? h.text.replace(/\n/g, ' ') : 'N/A'}`);
    }

    process.exit(0);
}
run();
