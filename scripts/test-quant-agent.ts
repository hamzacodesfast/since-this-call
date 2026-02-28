import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';

const redis = getRedisClient();

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function injectMockCall(username: string, symbol: string, sentiment: string, userWR: number, isGoodTicker: boolean) {
    const tweetId = `mock_${Date.now()}`;
    const timestamp = Date.now();

    const call = {
        id: tweetId,
        username,
        author: username,
        symbol,
        sentiment,
        performance: 0,
        isWin: false,
        timestamp,
        type: 'CRYPTO'
    };

    // 1. Setup Mock User Profile
    await redis.hset(`user:profile:${username}`, {
        username,
        totalAnalyses: 25,
        winRate: userWR
    });

    // 2. Setup Mock Ticker Profile limits
    if (!isGoodTicker) {
        // Tilted badly
        await redis.hset(`ticker:profile:CRYPTO:${symbol}`, {
            symbol,
            type: 'CRYPTO',
            totalAnalyses: 30,
            bullish: 29, // > 90% bullish
            winRate: 15  // < 30% WR
        });
    }

    // 3. Insert into User History
    await redis.lpush(`user:history:${username}`, JSON.stringify(call));

    // 4. Insert into Global Stream
    await redis.zadd('global:analyses:timestamp', { score: timestamp, member: `${username}:${tweetId}` });

    console.log(`[TEST] Injected mock call: ${username} -> ${sentiment} ${symbol}`);
}

async function main() {
    console.log("=== INJECTING MOCK DATA FOR QUANT AGENT TEST ===");

    // Test 1: Alpha 1 (Smart Money)
    // Username: EliteTrader, WR: 80%
    await injectMockCall('elitetrader', 'BTC', 'BULLISH', 80, true);
    await sleep(2500);

    // Test 2: Alpha 2 (Inverse CT User Fade)
    // Username: BadTrader, WR: 20%
    await injectMockCall('badtrader', 'ETH', 'BULLISH', 20, true);
    await sleep(2500);

    // Test 3: Alpha 2 (Inverse CT Ticker Fade)
    // Username: MidTrader, WR: 50% (Normal), Ticker: PENGUIN (Bad)
    await injectMockCall('midtrader', 'PENGUIN', 'BULLISH', 50, false);
    await sleep(2000);

    process.exit(0);
}

main();
