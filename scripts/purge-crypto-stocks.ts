import * as dotenv from 'dotenv';
import * as path from 'path';

// Load production environment
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';
import { getPrice, calculatePerformance } from '../src/lib/market-data';
import { StoredAnalysis } from '../src/lib/analysis-store';

const redis = getRedisClient();

const KNOWN_STOCKS = new Set([
    'MSTR', 'COIN', 'HOOD', 'TSLA', 'NVDA', 'AMD', 'INTC', 'AAPL', 'MSFT', 'GOOG', 'AMZN', 'NFLX', 'META', 'SPY', 'QQQ', 'IWM', 'DIA', 'GLD', 'SLV', 'TLT',
    'OKLO', 'SMR', 'ONDS', 'ASST', 'PLTR', 'MCD', 'BIZIM', 'DXY', 'XAU', 'XAG', 'XAUUSD', 'XAGUSD', 'OPEN',
    'GME', 'BABA', 'LAC', 'HIMS', 'SOFI', 'MARA', 'RIOT', 'CLSK', 'BITF', 'IREN', 'AMR', 'HCC', 'ARCH', 'BTU', 'CEIX', 'STLA', 'STX', 'CRCL', 'BMNR',
    'GC1:COM'
]);

async function main() {
    console.log('🔄 STARTING DEEP CLEAN FOR CRYPTO:STOCKS...');

    // 1. Purge from tracked_tickers
    const trackedTickers = await redis.smembers('tracked_tickers') as string[];
    const toRemove = new Set<string>();
    for (const key of trackedTickers) {
        if (key.startsWith('CRYPTO:')) {
            const sym = key.split(':')[1];
            if (KNOWN_STOCKS.has(sym) || sym === 'NVDAX') {
                toRemove.add(key);
            }
        }
    }
    if (toRemove.size > 0) {
        console.log(`Removing from tracked_tickers:`, Array.from(toRemove));
        await redis.srem('tracked_tickers', ...Array.from(toRemove));
    }

    // 2. Refresh actual NVDA price just to have it
    const nvdaPrice = await getPrice('NVDA', 'STOCK');
    console.log('Current NVDA Stock Price:', nvdaPrice);

    // 3. Scan ALL users and rewrite user:history
    const users = await redis.smembers('all_users') as string[];
    let fixCount = 0;

    for (const user of users) {
        const historyKey = `user:history:${user.toLowerCase()}`;
        const historyData = await redis.lrange(historyKey, 0, -1);
        if (!historyData || historyData.length === 0) continue;

        let needsRewrite = false;
        const history: StoredAnalysis[] = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        for (const item of history) {
            if (KNOWN_STOCKS.has(item.symbol) && item.type === 'CRYPTO') {
                item.type = 'STOCK';
                item.ticker = `STOCK:${item.symbol}`;
                if (item.symbol === 'NVDA' && nvdaPrice) {
                    item.currentPrice = nvdaPrice;
                    item.performance = calculatePerformance(item.entryPrice, nvdaPrice, item.sentiment || 'BULLISH');
                    item.isWin = item.performance > 0;
                }
                needsRewrite = true;
                fixCount++;
            }
            if (item.symbol === 'NVDAX') {
                item.symbol = 'NVDA';
                item.type = 'STOCK';
                item.ticker = `STOCK:NVDA`;
                if (nvdaPrice) {
                    item.currentPrice = nvdaPrice;
                    item.performance = calculatePerformance(item.entryPrice, nvdaPrice, item.sentiment || 'BULLISH');
                    item.isWin = item.performance > 0;
                }
                needsRewrite = true;
                fixCount++;
            }
        }

        if (needsRewrite) {
            await redis.del(historyKey);
            const pipeline = redis.pipeline();
            for (let j = history.length - 1; j >= 0; j--) {
                pipeline.lpush(historyKey, JSON.stringify(history[j]));
            }
            await pipeline.exec();
            console.log(`Rewrote history for ${user}`);
        }
    }

    // 4. recent_analyses
    const recentData = await redis.lrange('recent_analyses', 0, -1);
    let recentRewrote = false;
    const recent: StoredAnalysis[] = recentData.map((item: any) =>
        typeof item === 'string' ? JSON.parse(item) : item
    );
    for (const item of recent) {
        if (KNOWN_STOCKS.has(item.symbol) && item.type === 'CRYPTO') {
            item.type = 'STOCK';
            item.ticker = `STOCK:${item.symbol}`;
            if (item.symbol === 'NVDA' && nvdaPrice) {
                item.currentPrice = nvdaPrice;
                item.performance = calculatePerformance(item.entryPrice, nvdaPrice, item.sentiment || 'BULLISH');
                item.isWin = item.performance > 0;
            }
            recentRewrote = true;
        }
    }
    if (recentRewrote) {
        await redis.del('recent_analyses');
        const pipeline = redis.pipeline();
        for (let j = recent.length - 1; j >= 0; j--) {
            pipeline.lpush('recent_analyses', JSON.stringify(recent[j]));
        }
        await pipeline.exec();
        console.log('Rewrote recent_analyses');
    }

    console.log(`✅ Deep clean complete! Fixed ${fixCount} incorrect stock labels.`);
    process.exit(0);
}

main().catch(console.error);
