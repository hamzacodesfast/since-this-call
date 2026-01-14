
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function main() {
    const historyKey = 'user:history:jimcramer';
    const recentKey = 'recent_analyses';

    console.log('--- Jim Cramer History ---');
    const history = await redis.lrange(historyKey, 0, 5);
    history.forEach((item, i) => {
        const p = typeof item === 'string' ? JSON.parse(item) : item;
        console.log(`[${i}] ID: ${p.id} | Symbol: ${p.symbol} | Entry: ${p.entryPrice} | Current: ${p.currentPrice}`);
    });

    console.log('\n--- Recent Analyses (Global) ---');
    const recent = await redis.lrange(recentKey, 0, 20);
    recent.forEach((item, i) => {
        const p = typeof item === 'string' ? JSON.parse(item) : item;
        if (p.username.toLowerCase() === 'jimcramer') {
            console.log(`[${i}] ID: ${p.id} | Symbol: ${p.symbol} | Entry: ${p.entryPrice} | Current: ${p.currentPrice}`);
        }
    });

}

main();
