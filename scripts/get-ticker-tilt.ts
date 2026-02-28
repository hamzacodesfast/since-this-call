import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';

const redis = getRedisClient();

async function main() {
    const tickerKeys = await redis.smembers('tracked_tickers');
    const tickerStats = [];

    for (const key of tickerKeys) {
        if (key.startsWith('CA:')) continue;
        const refs = await redis.zrange(`ticker_index:${key}`, 0, -1);
        if (refs.length < 10) continue; // Require minimum call volume

        let wins = 0;
        let losses = 0;
        let totalCalls = 0;

        for (const ref of refs as string[]) {
            const [username, id] = ref.split(':');
            const historyData = await redis.lrange(`user:history:${username.toLowerCase()}`, 0, -1);

            for (const d of historyData) {
                const call = typeof d === 'string' ? JSON.parse(d) : d;
                if (call.id === id) {
                    // Make sure we only check calls that have a clear result determined
                    if (call.performance !== undefined && Math.abs(call.performance) >= 0.01) {
                        if (call.isWin) wins++;
                        else losses++;
                        totalCalls++;
                    }
                    break;
                }
            }
        }

        if (totalCalls >= 10) {
            const winRate = (wins / totalCalls) * 100;
            tickerStats.push({
                ticker: key,
                winRate,
                wins,
                losses,
                total: totalCalls
            });
        }
    }

    // Tilted to wins
    const easiestTickers = [...tickerStats].sort((a, b) => b.winRate - a.winRate).slice(0, 5);
    console.log("--- Easiest to Predict (Highest Win Rate) ---");
    for (const t of easiestTickers) {
        console.log(`[TILTED HIGH] ${t.ticker}: ${t.winRate.toFixed(1)}% WR (${t.wins}W / ${t.losses}L)`);
    }

    // Tilted to losses
    const hardestTickers = [...tickerStats].sort((a, b) => a.winRate - b.winRate).slice(0, 5);
    console.log("\n--- Hardest to Predict/Most Consistently Wrong (Lowest Win Rate) ---");
    for (const t of hardestTickers) {
        console.log(`[TILTED LOW] ${t.ticker}: ${t.winRate.toFixed(1)}% WR (${t.wins}W / ${t.losses}L)`);
    }

    // Highest Volume
    const highVolTickers = [...tickerStats].sort((a, b) => b.total - a.total).slice(0, 5);
    console.log("\n--- Highest Analysis Volume ---");
    for (const t of highVolTickers) {
        console.log(`[VOLUME] ${t.ticker}: ${t.total} total actionable calls (${t.winRate.toFixed(1)}% WR)`);
    }

    process.exit(0);
}
main();
