
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function verify() {
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
        token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
    });

    const username = 'GarrettBullish';
    const historyKey = `user:history:${username.toLowerCase()}`;
    const history = await redis.lrange(historyKey, 0, 0);

    console.log('Production Data for @GarrettBullish:');
    console.log(JSON.stringify(history[0], null, 2));
}

verify();
