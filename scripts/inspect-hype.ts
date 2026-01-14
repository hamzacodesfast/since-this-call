
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function main() {
    console.log("--- Inspecting HYPE ---");
    const data = await redis.lrange('recent_analyses', 0, -1);
    const items = data.map((x: any) => typeof x === 'string' ? JSON.parse(x) : x);

    // Tweet ID: 2010984930092990604
    const hype = items.find((x: any) => x.id === '2010984930092990604');

    if (hype) {
        console.log("Found HYPE Analysis:");
        console.log(JSON.stringify(hype, null, 2));
    } else {
        console.log("HYPE Analysis NOT FOUND in Redis");
    }
}
main();
