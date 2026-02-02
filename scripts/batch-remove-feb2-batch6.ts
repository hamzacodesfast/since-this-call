
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const redis = new Redis({
    url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const REMOVALS = [
    { id: '2017284206829683029', username: 'MB_Hogan' },
    { id: '2016940420207460596', username: 'MB_Hogan' },
    { id: '2013534133738185143', username: 'LennaertSnyder' }, // Vague up/down (appears twice in request, removing once)
    { id: '2016352328992096492', username: 'stevenmarkryan' }, // Poll/Question (appears twice)
    { id: '2017312848859607345', username: 'wallstengine' },
    { id: '2016999613564408277', username: 'wallstengine' },
    { id: '2013725327889969363', username: 'wallstengine' },
    { id: '2013924891628581087', username: 'wallstengine' },
    { id: '2013342199186931875', username: 'CyclesWithBach' },
    { id: '2017282177466307014', username: 'Cryptolution' }
];

async function removeBatch() {
    console.log(`🗑 Removing ${REMOVALS.length} tweets (Batch 6)...`);

    for (const { id, username } of REMOVALS) {
        console.log(`Processing ${id} (@${username})...`);

        await redis.del(`analysis:${id}`);

        const historyKey = `user:history:${username.toLowerCase()}`;
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
        const filteredHistory = history.filter((h: any) => h.id !== id);

        if (filteredHistory.length < history.length) {
            await redis.del(historyKey);
            if (filteredHistory.length > 0) {
                const p = redis.pipeline();
                filteredHistory.reverse().forEach((item: any) => p.lpush(historyKey, JSON.stringify(item)));
                await p.exec();
            }
            console.log(`   - Removed from user history`);
        }

        const recentData = await redis.lrange('recent_analyses', 0, -1);
        const recent = recentData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
        const filteredRecent = recent.filter((r: any) => r.id !== id);

        if (filteredRecent.length < recent.length) {
            await redis.del('recent_analyses');
            if (filteredRecent.length > 0) {
                const p = redis.pipeline();
                filteredRecent.forEach((item: any) => p.rpush('recent_analyses', JSON.stringify(item)));
                await p.exec();
            }
            console.log(`   - Removed from recent feed`);
        }
    }
    console.log('✅ Removal complete.');
}

removeBatch().catch(console.error);
