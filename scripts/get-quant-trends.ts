import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';

const redis = getRedisClient();

async function main() {
    const allUsers = await redis.smembers('all_users');
    const profiles = [];

    for (const username of allUsers) {
        const p = await redis.hgetall('user:profile:' + username.toLowerCase());
        if (p && parseInt(p.totalAnalyses) >= 20) {
            profiles.push({
                username: p.username || username,
                winRate: parseFloat(p.winRate || 0),
                total: parseInt(p.totalAnalyses),
                wins: parseInt(p.wins),
                losses: parseInt(p.losses)
            });
        }
    }

    const topPredictors = profiles.filter(p => p.winRate >= 60).sort((a, b) => b.winRate - a.winRate);
    const worstPredictors = profiles.filter(p => p.winRate <= 40).sort((a, b) => a.winRate - b.winRate);

    console.log("--- Alpha Stream 1 Candidates (Top Predictors) ---");
    for (const p of topPredictors.slice(0, 5)) {
        const historyData = await redis.lrange(`user:history:${p.username.toLowerCase()}`, 0, 0);
        if (historyData.length > 0) {
            const item = historyData[0];
            const call = typeof item === 'string' ? JSON.parse(item) : item;
            console.log(`[MIRROR] ${p.username} (${p.winRate.toFixed(1)}% WR | ${p.total} calls) -> ${call.sentiment} ${call.symbol} at ${call.entryPrice} on ${new Date(call.timestamp).toISOString()}`);
        }
    }

    console.log("\n--- Alpha Stream 2 Candidates (Worst Predictors to Fade) ---");
    for (const p of worstPredictors.slice(0, 5)) {
        const historyData = await redis.lrange(`user:history:${p.username.toLowerCase()}`, 0, 0);
        if (historyData.length > 0) {
            const item = historyData[0];
            const call = typeof item === 'string' ? JSON.parse(item) : item;
            console.log(`[FADE] ${p.username} (${p.winRate.toFixed(1)}% WR | ${p.total} calls) -> original call: ${call.sentiment} ${call.symbol} on ${new Date(call.timestamp).toISOString()}`);
        }
    }

    console.log("\n--- Alpha Stream 3 (Volume Spikes) ---");
    const recentData = await redis.lrange('recent_analyses', 0, 500);
    const tickerCounts: Record<string, { bullish: number, bearish: number }> = {};
    for (const d of recentData) {
        const call = typeof d === 'string' ? JSON.parse(d) : d;
        if (!tickerCounts[call.symbol]) tickerCounts[call.symbol] = { bullish: 0, bearish: 0 };
        if (call.sentiment === 'BULLISH') tickerCounts[call.symbol].bullish++;
        if (call.sentiment === 'BEARISH') tickerCounts[call.symbol].bearish++;
    }

    const sortedTickers = Object.entries(tickerCounts)
        .sort((a, b) => (b[1].bullish + b[1].bearish) - (a[1].bullish + a[1].bearish))
        .slice(0, 5);

    for (const [ticker, counts] of sortedTickers) {
        console.log(`[MOMENTUM] ${ticker} -> ${counts.bullish} BULLISH, ${counts.bearish} BEARISH calls recently.`);
    }

    process.exit(0);
}
main();
