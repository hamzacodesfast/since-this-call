import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const redis = new Redis({
    url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});
async function test() {
    const items = await redis.zrange('user_index:theskayeth', 0, -1);
    console.log("length:", items.length);
    process.exit(0);
}
test();
