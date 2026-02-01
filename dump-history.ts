import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function main() {
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
        token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
    });

    const username = process.argv[2] || 'trendspider';
    console.log(`Fetching history for ${username}...`);

    const historyData = await redis.lrange(`user:history:${username.toLowerCase()}`, 0, -1);
    const ids = historyData.map((item: any) => {
        const parsed = typeof item === 'string' ? JSON.parse(item) : item;
        return parsed.id;
    });

    const filename = `${username.toLowerCase()}_full.json`;
    console.log(`Found ${ids.length} tweets. Writing to ${filename}...`);
    await fs.writeFile(filename, JSON.stringify(ids, null, 2));
    console.log('✅ Done.');
}

main();
