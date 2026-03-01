import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const redis = new Redis({
    url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function check() {
    const history = await redis.lrange('user:history:longinvest32', 0, -1);
    console.log("Found", history.length, "items for longinvest32");
    for (const h of history) {
        const item = typeof h === 'string' ? JSON.parse(h) : h;
        if (item.symbol === 'NVDA') {
            const p = await redis.zrange(`ticker_index:STOCK:NVDA`, 0, -1);
            console.log("ITEM:", JSON.stringify(item, null, 2));
            console.log("Index mapped:", p.includes(`longinvest32:${item.id}`));
        }
    }
}
check();
