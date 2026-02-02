
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
    { id: '2013743691555373560', username: 'MacroCRG' },
    { id: '2017294777960579564', username: 'markminervini' },
    { id: '2017451080054186412', username: '0xBossman' },
    { id: '2017325006380798202', username: 'TmarketL' },
    { id: '2017345416681898179', username: 'TmarketL' },
    { id: '2017235223331602899', username: 'itsCblast' },
    { id: '2016923048738185709', username: 'itsCblast' }
];

async function removeBatch() {
    console.log(`🗑 Removing ${REMOVALS.length} tweets (Batch 3)...`);

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
    console.log('✅ Removal complete.');
}

removeBatch().catch(console.error);
