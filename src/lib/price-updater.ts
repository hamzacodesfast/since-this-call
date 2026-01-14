
import { Redis } from '@upstash/redis';
import { getPrice } from './market-data';
import { calculatePerformance } from './market-data';
import { updateUserProfile, StoredAnalysis } from './analysis-store';

// Lazy initialization or ensure env is loaded? 
// Ideally we rely on process.env being set.
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

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
    // Update top 20 to be safe
    const REFRESH_LIMIT = 20;

    for (let i = 0; i < Math.min(history.length, REFRESH_LIMIT); i++) {
        const item = history[i];
        let hasItemChanges = false;

        // Determine type (Default to CRYPTO if missing - most are crypto)
        const type = item.type || 'CRYPTO';

        // 1. Backfill Entry Price if missing OR Forced
        if (!item.entryPrice || force) {
            console.log(`[PriceUpdater] Backfilling entry price for ${item.symbol} (${item.id})...`);
            try {
                const entryPrice = await getPrice(item.symbol, type, new Date(item.timestamp));
                if (entryPrice) {
                    item.entryPrice = entryPrice;
                    item.type = type; // Persist inferred type
                    hasItemChanges = true;
                } else {
                    console.warn(`[PriceUpdater] Failed to fetch historical price for ${item.symbol}`);
                    continue; // Can't update without entry price
                }
            } catch (e) {
                console.warn(`[PriceUpdater] Error fetching hist price for ${item.symbol}:`, e);
            }
        }

        // 2. Fetch Current Price & Update Performance
        if (item.entryPrice) {
            const currentPrice = await getPrice(item.symbol, type);

            if (currentPrice) {
                const newPerformance = calculatePerformance(item.entryPrice, currentPrice, item.sentiment);
                const isWin = newPerformance > 0;

                // Update fields if changed (add tolerance)
                const perfChanged = Math.abs(item.performance - newPerformance) > 0.001;
                const winChanged = item.isWin !== isWin;

                if (perfChanged || winChanged || item.currentPrice !== currentPrice) {
                    item.currentPrice = currentPrice;
                    item.performance = newPerformance;
                    item.isWin = isWin;
                    hasItemChanges = true;
                }
            }
        }

        if (hasItemChanges) {
            hasChanges = true;
        }
    }

    if (hasChanges) {
        // Recalculate Stats
        let wins = 0;
        let losses = 0;
        let neutral = 0;
        const total = history.length;

        for (const item of history) {
            if (Math.abs(item.performance) < 0.01) {
                neutral++;
            } else if (item.isWin) {
                wins++;
            } else {
                losses++;
            }
        }

        const winRate = total > 0 ? (wins / total) * 100 : 0;
        const profileKey = `${USER_PROFILE_PREFIX}${lowerUser}`;

        // Update Profile
        await redis.hset(profileKey, {
            wins,
            losses,
            neutral,
            winRate,
            lastAnalyzed: Date.now(),
        });

        // Save History
        await redis.del(historyKey);
        for (let i = history.length - 1; i >= 0; i--) {
            await redis.lpush(historyKey, JSON.stringify(history[i]));
        }

        console.log(`[PriceUpdater] Updated ${username}`);
    } else {
        console.log(`[PriceUpdater] No changes for ${username}`);
    }
}
