import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';

const redis = getRedisClient();

async function main() {
    const tickerKeys = await redis.smembers('tracked_tickers');
    const tickerStats = [];

    console.log("Gathering data for extreme tilt analysis...");

    for (const key of tickerKeys) {
        if (key.startsWith('CA:')) continue;
        const refs = await redis.zrange(`ticker_index:${key}`, 0, -1);
        if (refs.length < 20) continue; // Require minimum 20 calls for statistical significance

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

        const totalSentiment = bullish + bearish;
        if (totalSentiment >= 20) {
            const bullishTilt = (bullish / totalSentiment) * 100;
            const bearishTilt = (bearish / totalSentiment) * 100;
            const winRate = totalCalls > 0 ? (wins / totalCalls) * 100 : 0;

            tickerStats.push({
                ticker: key,
                winRate,
                bullishTilt,
                bearishTilt,
                total: totalSentiment,
                resolved: totalCalls
            });
        }
    }

    // >90% Bullish Tilt
    const extremeBullish = tickerStats.filter(t => t.bullishTilt >= 90).sort((a, b) => b.total - a.total);
    console.log("\n--- >90% BULLISH Consensus Tickers (Counter-Trade Candidates = SHORT) ---");
    for (const t of extremeBullish) {
        console.log(`[EXTREME BULL TILT] ${t.ticker}: ${t.bullishTilt.toFixed(1)}% Bullish (${t.total} calls) -> Crowd Win Rate: ${t.winRate.toFixed(1)}%`);
    }

    // >90% Bearish Tilt
    const extremeBearish = tickerStats.filter(t => t.bearishTilt >= 90).sort((a, b) => b.total - a.total);
    console.log("\n--- >90% BEARISH Consensus Tickers (Counter-Trade Candidates = LONG) ---");
    for (const t of extremeBearish) {
        console.log(`[EXTREME BEAR TILT] ${t.ticker}: ${t.bearishTilt.toFixed(1)}% Bearish (${t.total} calls) -> Crowd Win Rate: ${t.winRate.toFixed(1)}%`);
    }

    process.exit(0);
}
main();
