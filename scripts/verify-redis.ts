
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function main() {
    console.log('Checking recent_analyses...');
    const len = await redis.llen('recent_analyses');
    console.log(`Length: ${len}`);

    if (len > 0) {
        const items = await redis.lrange('recent_analyses', 0, 5);
        console.log('Sample items:', items);
    }
}

main();
