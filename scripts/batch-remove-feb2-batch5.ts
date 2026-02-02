
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
    { id: '2017362011600888093', username: 'PARABOLIT' },
    { id: '2017273741340803090', username: 'PARABOLIT' },
    { id: '2017335883003736350', username: 'alc2022' },
    { id: '2017224436965896578', username: 'EricBalchunas' },
    { id: '2015987918670590009', username: 'cfromhertz' },
    { id: '2016755750778064920', username: 'milesdeutscher' },
    { id: '2017305075744481331', username: 'Credib1eGuy' },
    { id: '2017599122027512125', username: 'CaseyVSilver' },
    { id: '2016779821355778348', username: 'FinanceLancelot' },
    { id: '2013703464820375576', username: 'TomLeeUpdates' },
    { id: '2017295647137788098', username: 'Braczyy' },
    { id: '2017315014613626996', username: 'BrutalBtc' },
    { id: '2017615122147983633', username: 'RichardMoglen' },
    { id: '2016946614980792720', username: 'RichardMoglen' },
    { id: '2016990435038613810', username: 'InvestingVisual' },
    { id: '2016981009074475169', username: 'InvestingVisual' }
];

async function removeBatch() {
    console.log(`🗑 Removing ${REMOVALS.length} tweets (Batch 5)...`);

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
