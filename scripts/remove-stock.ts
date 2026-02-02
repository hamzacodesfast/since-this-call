
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const redis = new Redis({
    url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const REMOVALS = [
    { id: '2016981643949478045', username: 'stockmktnewz' },
    { id: '2017001307794518516', username: 'stockmktnewz' },
    { id: '2016629376104751177', username: 'stockmktnewz' }
];

async function removeBatch() {
    console.log(`🗑 Removing ${REMOVALS.length} news tweets...`);

    for (const { id, username } of REMOVALS) {
        console.log(`Processing ${id} (@${username})...`);

        // 1. Remove from Global Store
        await redis.del(`analysis:${id}`);

        // 2. Remove from User History
        const historyKey = `user:history:${username.toLowerCase()}`;
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
        const filteredHistory = history.filter((h: any) => h.id !== id);

        if (filteredHistory.length < history.length) {
            await redis.del(historyKey);
            if (filteredHistory.length > 0) {
                const p = redis.pipeline();
                for (let i = filteredHistory.length - 1; i >= 0; i--) {
                    p.lpush(historyKey, JSON.stringify(filteredHistory[i]));
                }
                await p.exec();
            }
            console.log(`   - Removed from user history`);
        }

        // 3. Remove from Recent Feed
        const recentData = await redis.lrange('recent_analyses', 0, -1);
        const recent = recentData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
        const filteredRecent = recent.filter((r: any) => r.id !== id);

        if (filteredRecent.length < recent.length) {
            await redis.del('recent_analyses');
            if (filteredRecent.length > 0) {
                const p = redis.pipeline();
                for (const item of filteredRecent) {
                    p.rpush('recent_analyses', JSON.stringify(item));
                }
                await p.exec();
            }
            console.log(`   - Removed from recent feed`);
        }
    }
    console.log('✅ Batch removal complete.');
}

removeBatch().catch(console.error);
