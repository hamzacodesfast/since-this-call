import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const redis = new Redis({
    url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});
async function test() {
    console.log(await redis.hgetall('user:profile:theskayeth'));
    
    // Check global_analyses again
    const all = await redis.zrange('global:analyses:timestamp', 0, -1) as string[];
    const skayeth = all.filter(a => a.toLowerCase().startsWith('theskayeth:'));
    console.log("TheSkayeth in global:", skayeth.length);
    process.exit(0);
}
test();
