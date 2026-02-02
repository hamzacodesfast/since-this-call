
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
    { id: '2017238943998112243', username: 'CryptoCaesarTA' },
    { id: '2013973067257479197', username: 'CryptoCaesarTA' },
    { id: '2016990625942388882', username: 'alphatrends' },
    { id: '2013754176891711909', username: 'chikun' },
    { id: '2017208526066835936', username: 'altbullx' },
    { id: '2017399626412773775', username: 'Jova_Beta' },
    { id: '2017219303972503692', username: 'garyblack00' },
    { id: '2014375761562546209', username: 'pepemoonboy' },
    { id: '2017142569373966682', username: 'waleswoosh' },
    { id: '2014382555747737670', username: 'LP_NXT' },
    { id: '2017301699287736598', username: 'MentoviaX' },
    { id: '2017296718107218067', username: 'EdgeCGroup' },
    { id: '2017249612390625546', username: 'EdgeCGroup' },
    { id: '2016974048727572695', username: 'EdgeCGroup' }
];

async function removeBatch() {
    console.log(`🗑 Removing ${REMOVALS.length} tweets (Batch 4)...`);

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
                // Push in reverse order to maintain correct list order
                filteredHistory.reverse().forEach((item: any) => p.lpush(historyKey, JSON.stringify(item)));
                await p.exec();
            }
            console.log(`   - Removed from user history`);
        }

        // Remove from recent feed
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
