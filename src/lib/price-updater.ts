import { getRedisClient } from './redis-client';
import { getPrice, calculatePerformance, inferAssetType } from './market-data';
import { updateGlobalRecentAnalysis, StoredAnalysis } from './analysis-store';

const redis = getRedisClient();

const ALL_USERS_KEY = 'all_users';
const USER_HISTORY_PREFIX = 'user:history:';
const USER_PROFILE_PREFIX = 'user:profile:';

export async function refreshAllProfiles(force: boolean = false) {
    console.log('[PriceUpdater] Starting refresh...');
    const users = await redis.smembers(ALL_USERS_KEY);
    console.log(`[PriceUpdater] Found ${users.length} users.`);

    let updatedCount = 0;

    for (const user of users) {
        try {
            await refreshUser(user, force);
            updatedCount++;
        } catch (e) {
            console.error(`[PriceUpdater] Failed to update ${user}:`, e);
        }
    }
    console.log(`[PriceUpdater] Completed. Updated ${updatedCount} profiles.`);
}

export async function refreshUser(username: string, force: boolean = false) {
    const lowerUser = username.toLowerCase();
    const historyKey = `${USER_HISTORY_PREFIX}${lowerUser}`;

    // Get history
    const historyData = await redis.lrange(historyKey, 0, -1);
    const history: StoredAnalysis[] = historyData.map((item: any) =>
        typeof item === 'string' ? JSON.parse(item) : item
    );

    let hasChanges = false;
    const REFRESH_LIMIT = 20;

    for (let i = 0; i < Math.min(history.length, REFRESH_LIMIT); i++) {
        const item = history[i];
        let hasItemChanges = false;

        let type = item.type || inferAssetType(item.symbol);
        if (['BTC', 'ETH', 'SOL', 'USDT'].includes(item.symbol.toUpperCase())) {
            type = 'CRYPTO';
        }

        const callDate = new Date(item.timestamp);

        // 1. Backfill Entry Price if missing OR Forced
        if (!item.entryPrice || force) {
            try {
                const entryPrice = await getPrice(item.symbol, type, callDate);
                if (entryPrice) {
                    item.entryPrice = entryPrice;
                    item.type = type;
                    hasItemChanges = true;
                }
            } catch (e) {
                console.warn(`[PriceUpdater] Error fetching entry price for ${item.symbol}:`, e);
            }
        }

        // 2. Fetch Current Price & Update Performance
        if (item.entryPrice) {
            try {
                const currentPrice = await getPrice(item.symbol, type);
                if (currentPrice) {
                    const newPerformance = calculatePerformance(item.entryPrice, currentPrice, item.sentiment);
                    const isWin = newPerformance > 0;

                    if (item.currentPrice !== currentPrice || Math.abs(item.performance - newPerformance) > 0.001) {
                        item.currentPrice = currentPrice;
                        item.performance = newPerformance;
                        item.isWin = isWin;
                        hasItemChanges = true;
                    }
                    await updateGlobalRecentAnalysis(item);
                }
            } catch (e) {
                console.warn(`[PriceUpdater] Error fetching current price for ${item.symbol}:`, e);
            }
        }

        if (hasItemChanges) {
            hasChanges = true;
        }
    }

    if (hasChanges) {
        let wins = 0, losses = 0, neutral = 0;
        const total = history.length;
        for (const item of history) {
            if (Math.abs(item.performance) < 0.01) neutral++;
            else if (item.isWin) wins++;
            else losses++;
        }

        const winRate = total > 0 ? (wins / total) * 100 : 0;
        const profileKey = `${USER_PROFILE_PREFIX}${lowerUser}`;

        await redis.hset(profileKey, {
            wins,
            losses,
            neutral,
            winRate,
            lastAnalyzed: Date.now(),
        });

        await redis.del(historyKey);
        const pipeline = redis.pipeline();
        for (let i = history.length - 1; i >= 0; i--) {
            pipeline.lpush(historyKey, JSON.stringify(history[i]));
        }
        await pipeline.exec();
        console.log(`[PriceUpdater] Updated ${username}`);
    }
}
