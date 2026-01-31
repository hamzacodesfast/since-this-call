
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

const TRACKED_TICKERS_KEY = 'tracked_tickers';
const TICKER_INDEX_PREFIX = 'ticker_index:';
const USER_HISTORY_PREFIX = 'user:history:';
const USER_PROFILE_PREFIX = 'user:profile:';
const RECENT_KEY = 'recent_analyses';

async function main() {
    console.log('🔄 STARTING UNIFORM PRICE REFRESH...');

    // 1. Get All Tracked Tickers
    const tickerKeys = await redis.smembers(TRACKED_TICKERS_KEY);
    console.log(`[UniformRefresh] Found ${tickerKeys.length} tracked tickers.`);

    const priceMap: Record<string, number> = {};
    const failedTickers: string[] = [];

    // 2. Fetch Prices Once per Ticker
    console.log('[UniformRefresh] Fetching latest prices...');
    for (const key of tickerKeys) {
        try {
            let price: number | null = null;
            if (key.startsWith('CA:')) {
                // We no longer support CA-based tracking. Skip.
                continue;
            } else {
                const [type, symbol] = key.split(':');
                price = await getPrice(symbol, type as any);
            }

            if (price) {
                priceMap[key] = price;
            } else {
                failedTickers.push(key);
            }
        } catch (e) {
            console.error(`[UniformRefresh] Failed to fetch price for ${key}:`, e);
            failedTickers.push(key);
        }
    }
    console.log(`[UniformRefresh] Fetched ${Object.keys(priceMap).length} prices. (${failedTickers.length} failed)`);

    // 3. Find Affected Users & Calls
    const affectedUsers: Record<string, { id: string, tickerKey: string }[]> = {};

    for (const tickerKey of Object.keys(priceMap)) {
        const refs = await redis.zrange(`${TICKER_INDEX_PREFIX}${tickerKey}`, 0, -1);
        for (const ref of refs as string[]) {
            const [username, id] = ref.split(':');
            if (!affectedUsers[username]) affectedUsers[username] = [];
            affectedUsers[username].push({ id, tickerKey });
        }
    }

    const usernames = Object.keys(affectedUsers);
    console.log(`[UniformRefresh] Updating ${usernames.length} users...`);

    // 4. Update User Histories & Profiles
    let totalUpdatedCalls = 0;
    for (const username of usernames) {
        const lowerUser = username.toLowerCase();
        const historyKey = `${USER_HISTORY_PREFIX}${lowerUser}`;

        const historyData = await redis.lrange(historyKey, 0, -1);
        const history: StoredAnalysis[] = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        let hasHistoryChanges = false;
        for (const item of history) {
            // Reconstruct ticker key (new logic: no contractAddress check)
            const tickerKey = `${item.type || 'CRYPTO'}:${item.symbol.toUpperCase()}`;

            const newPrice = priceMap[tickerKey];
            if (newPrice && item.entryPrice) {
                const newPerformance = calculatePerformance(item.entryPrice, newPrice, item.sentiment || 'BULLISH');
                const isWin = newPerformance > 0;

                // Update if price or performance changed
                if (item.currentPrice !== newPrice || Math.abs(item.performance - newPerformance) > 0.001) {
                    item.currentPrice = newPrice;
                    item.performance = newPerformance;
                    item.isWin = isWin;
                    hasHistoryChanges = true;
                    totalUpdatedCalls++;
                }
            }
        }

        if (hasHistoryChanges) {
            // Recalculate Stats for Profile
            let wins = 0;
            let losses = 0;
            let neutral = 0;
            for (const hItem of history) {
                if (Math.abs(hItem.performance) < 0.05) neutral++;
                else if (hItem.isWin) wins++;
                else losses++;
            }
            const winRate = history.length > 0 ? (wins / history.length) * 100 : 0;

            const profileKey = `${USER_PROFILE_PREFIX}${lowerUser}`;
            await redis.hset(profileKey, {
                wins,
                losses,
                neutral,
                winRate,
                totalAnalyses: history.length,
                lastAnalyzed: Date.now()
            });

            // Save History
            await redis.del(historyKey);
            const pipeline = redis.pipeline();
            for (let i = history.length - 1; i >= 0; i--) {
                pipeline.lpush(historyKey, JSON.stringify(history[i]));
            }
            await pipeline.exec();
        }
    }

    // 5. Update Recent Analyses List
    console.log('[UniformRefresh] Updating recent_analyses list...');
    const recentData = await redis.lrange(RECENT_KEY, 0, -1);
    const recentItems: StoredAnalysis[] = recentData.map((item: any) =>
        typeof item === 'string' ? JSON.parse(item) : item
    );

    let hasRecentChanges = false;
    for (const item of recentItems) {
        const tickerKey = `${item.type || 'CRYPTO'}:${item.symbol.toUpperCase()}`;

        const newPrice = priceMap[tickerKey];
        if (newPrice && item.entryPrice) {
            const newPerformance = calculatePerformance(item.entryPrice, newPrice, item.sentiment || 'BULLISH');
            const isWin = newPerformance > 0;

            if (item.currentPrice !== newPrice || Math.abs(item.performance - newPerformance) > 0.001) {
                item.currentPrice = newPrice;
                item.performance = newPerformance;
                item.isWin = isWin;
                hasRecentChanges = true;
            }
        }
    }

    if (hasRecentChanges) {
        await redis.del(RECENT_KEY);
        const pipeline = redis.pipeline();
        for (const item of recentItems.reverse()) {
            pipeline.lpush(RECENT_KEY, JSON.stringify(item));
        }
        await pipeline.exec();
    }

    console.log(`✅ Uniform Refresh Complete.`);
    console.log(`- Updated: ${totalUpdatedCalls} call occurrences`);
    console.log(`- Covered: ${usernames.length} users`);

    process.exit(0);
}

main();
