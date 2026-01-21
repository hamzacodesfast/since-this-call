import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const TWEET_IDS = [
    '2013304954773975187'
];

async function removeMultiple() {
    console.log('🗑️ Removing', TWEET_IDS.length, 'tweets...');

    const all = await redis.lrange('recent_analyses', 0, -1);
    const analyses = all.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);

    const filtered = analyses.filter((a: any) => !TWEET_IDS.includes(a.id));
    const removedCount = analyses.length - filtered.length;

    if (removedCount > 0) {
        await redis.del('recent_analyses');
        for (let i = filtered.length - 1; i >= 0; i--) {
            await redis.lpush('recent_analyses', JSON.stringify(filtered[i]));
        }
        console.log(`✅ Removed ${removedCount} tweets from recent_analyses`);
    } else {
        console.log('ℹ️ Tweets not found in recent_analyses');
    }

    console.log('Done! Ready to re-test.');
    process.exit(0);
}

removeMultiple();
