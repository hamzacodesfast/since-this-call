import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';

const redis = getRedisClient();

async function main() {
    const targets = ['STOCK:IREN', 'STOCK:NBIS', 'CRYPTO:IREN', 'CRYPTO:NBIS'];

    for (const key of targets) {
        const refs = await redis.zrange(`ticker_index:${key}`, 0, -1);
        if (!refs || refs.length === 0) continue;

        let wins = 0;
        let losses = 0;
        let totalCalls = 0;
        let bullish = 0;
        let bearish = 0;

        for (const ref of refs as string[]) {
            const [username, id] = ref.split(':');
            const historyData = await redis.lrange(`user:history:${username.toLowerCase()}`, 0, -1);

            for (const d of historyData) {
                const call = typeof d === 'string' ? JSON.parse(d) : d;
                if (call.id === id) {
                    if (call.sentiment === 'BULLISH') bullish++;
                    if (call.sentiment === 'BEARISH') bearish++;

                    if (call.performance !== undefined && Math.abs(call.performance) >= 0.01) {
                        if (call.isWin) wins++;
                        else losses++;
                        totalCalls++;
                    }
                    break;
                }
            }
        }

        const winRate = totalCalls > 0 ? (wins / totalCalls) * 100 : 0;
        console.log(`\n--- Analysis for ${key} ---`);
        console.log(`Total Logged Calls: ${refs.length}`);
        console.log(`Actionable Calls (Completed/Resolved): ${totalCalls}`);
        console.log(`Sentiment Bias: ${bullish} BULLISH vs ${bearish} BEARISH`);
        if (totalCalls > 0) {
            console.log(`Win Rate: ${winRate.toFixed(1)}% (${wins}W / ${losses}L)`);
        }
    }

    process.exit(0);
}
main();
