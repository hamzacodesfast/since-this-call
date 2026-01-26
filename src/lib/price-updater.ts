import { getRedisClient } from './redis-client';
import { getPrice, calculatePerformance, inferAssetType } from './market-data';
import { updateUserProfile, StoredAnalysis } from './analysis-store';

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
    // Update top 20 to be safe
    const REFRESH_LIMIT = 20;

    for (let i = 0; i < Math.min(history.length, REFRESH_LIMIT); i++) {
        const item = history[i];
        let hasItemChanges = false;

        // Determine type (Default to CRYPTO if missing - most are crypto)
        // Use updated inference logic to catch things like MSTR
        let type = item.type || inferAssetType(item.symbol);

        // FORCE FIX: Major cryptos must be CRYPTO (Fixes legacy "Stock" misclassification for ETH)
        if (['BTC', 'ETH', 'SOL', 'USDT', 'USDT.D', 'USDT.P'].includes(item.symbol.toUpperCase())) {
            type = 'CRYPTO';
        }


        // 1. Backfill Entry Price if missing OR Forced
        // 1. Backfill Entry Price if missing OR Forced
        if (!item.entryPrice || force) {
            console.log(`[PriceUpdater] Backfilling entry price for ${item.symbol} (${item.id})...`);
            try {
                let entryPrice: number | null = null;
                const callDate = new Date(item.timestamp);

                // Priority 1: Contract Address Lookup (Pump.fun / DexScreener)
                // This mimics the robust logic in analyzer.ts (lines 202-262)
                if (item.contractAddress && item.contractAddress.length > 10) {
                    // Import dynamically to avoid circular deps if needed, but we can import from market-data
                    const { getPriceByContractAddress, getGeckoTerminalPrice, getPairInfoByCA } = await import('./market-data');
                    const { getPumpfunPrice: getStoredPrice } = await import('./analysis-store'); // Rename to avoid conflict

                    const caData = await getPriceByContractAddress(item.contractAddress);
                    if (caData) {
                        const tweetAgeMs = Date.now() - callDate.getTime();
                        const tweetAgeHours = tweetAgeMs / (1000 * 60 * 60);

                        // A. Historical GeckoTerminal (Top Priority for >24h)
                        if (tweetAgeHours > 24) {
                            const pairInfo = await getPairInfoByCA(item.contractAddress);
                            if (pairInfo) {
                                const gtPrice = await getGeckoTerminalPrice(pairInfo.chainId, pairInfo.pairAddress, callDate);
                                if (gtPrice !== null) {
                                    entryPrice = gtPrice;
                                    console.log(`[PriceUpdater] Used GeckoTerminal historical for ${item.symbol}`);
                                }
                            }
                        }

                        // B. DexScreener PriceChange (Recent)
                        if (entryPrice === null && tweetAgeHours <= 24 && caData.priceChange) {
                            let percentChange: number | undefined;
                            if (tweetAgeHours <= 1 && caData.priceChange.h1 !== undefined) percentChange = caData.priceChange.h1;
                            else if (tweetAgeHours <= 6 && caData.priceChange.h6 !== undefined) percentChange = caData.priceChange.h6;
                            else if (tweetAgeHours <= 24 && caData.priceChange.h24 !== undefined) percentChange = caData.priceChange.h24;

                            if (percentChange !== undefined && percentChange !== 0) {
                                entryPrice = caData.price / (1 + percentChange / 100);
                                console.log(`[PriceUpdater] Used DexScreener delta for ${item.symbol}`);
                            }
                        }

                        // C. Stored Price Fallback
                        if (entryPrice === null) {
                            const stored = await getStoredPrice(item.contractAddress);
                            if (stored) {
                                entryPrice = stored.price;
                                console.log(`[PriceUpdater] Used stored pumpfun price for ${item.symbol}`);
                            }
                        }
                    }
                }

                // Priority 2: Standard Lookup (Stocks / Major Crypto) if CA failed or missing
                if (entryPrice === null) {
                    entryPrice = await getPrice(item.symbol, type, callDate);
                }

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
