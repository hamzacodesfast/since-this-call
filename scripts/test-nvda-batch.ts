import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const redis = new Redis({
    url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function check() {
    console.log("Tracked tickers with NVDA:");
    const trackedTickers = await redis.smembers('tracked_tickers') as string[];
    const nvdas = trackedTickers.filter(t => t.includes('NVDA'));
    console.log(nvdas);

    for (const t of nvdas) {
        console.log(`\n--- ${t} ---`);
        const recent = await redis.zrange(`ticker_index:${t}`, 0, 5) as string[];
        console.log("Recent refs:", recent);
    }
}
check();
