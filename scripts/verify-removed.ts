
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function check() {
    const ids = ['2016641794042191923', '2016619058074898729', '2017334609885925728'];
    for (const id of ids) {
        const exists = await redis.exists('analysis:' + id);
        console.log(`ID ${id} exists: ${exists}`);
    }
}
check();
