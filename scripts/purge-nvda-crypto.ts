import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });
dotenv.config({ path: '.env.local' });

const redis = new Redis({
    url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function run() {
    console.log("Removing CRYPTO:NVDA and CRYPTO:NVDAX from tracked_tickers");
    await redis.srem('tracked_tickers', 'CRYPTO:NVDA', 'CRYPTO:NVDAX');
    
    const index = await redis.zrange('ticker_index:CRYPTO:NVDA', 0, -1) as string[];
    console.log("Migrating", index.length, "items from CRYPTO:NVDA to STOCK:NVDA");
    for (const item of index) {
        await redis.zadd('ticker_index:STOCK:NVDA', { score: Date.now(), member: item });
    }
    await redis.del('ticker_index:CRYPTO:NVDA', 'ticker_index:CRYPTO:NVDAX');
    console.log("Done");
}
run();
