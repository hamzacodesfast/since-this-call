import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const redis = new Redis({
    url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});
async function test() {
    const score = await redis.zscore('global_analyses', 'TheSkayeth:1234'); // just to check what can be inside
}
