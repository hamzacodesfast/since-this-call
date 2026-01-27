
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load production environment first (Main First)
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';
import { getPrice, calculatePerformance, inferAssetType } from '../src/lib/market-data';
import { StoredAnalysis, updateGlobalRecentAnalysis } from '../src/lib/analysis-store';

const redis = getRedisClient();

const USER_HISTORY_PREFIX = 'user:history:';
const USER_PROFILE_PREFIX = 'user:profile:';
const ALL_USERS_KEY = 'all_users';

async function main() {
    console.log('🔄 STARTING NEUTRAL CALL REFRESH (Robust v2)...');

    // 1. Get All Users
    const users = await redis.smembers(ALL_USERS_KEY);
    console.log(`[NeutralRefresh] Found ${users.length} users.`);

    let totalUpdated = 0;
    let totalScanned = 0;

    for (const username of users) {
        const lowerUser = username.toLowerCase();
        const historyKey = `${USER_HISTORY_PREFIX}${lowerUser}`;

        // 2. Fetch ENTIRE history
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history: StoredAnalysis[] = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        let hasChanges = false;
        let userUpdates = 0;

        for (const item of history) {
            totalScanned++;

            // 3. Identify Neutral / Flat Calls OR Missing Entry Price
            // "Neutral" = Performance is exactly 0 or very close (floating point)
            // Also target things with performance = 0 but NO entry price
            // UI uses < 0.05, so we should match that
            // Also catch undefined/null performance
            const isNeutral = !item.performance || Math.abs(item.performance) < 0.05;
            const needsEntry = !item.entryPrice;

            if (isNeutral || needsEntry) {
                // Determine initial type
                let type: 'CRYPTO' | 'STOCK' = item.type || inferAssetType(item.symbol);
                if (['BTC', 'ETH', 'SOL', 'USDT', 'USDT.D', 'USDT.P'].includes(item.symbol.toUpperCase())) {
                    type = 'CRYPTO';
                    // Force fix type if mismatch
                    if (item.type !== 'CRYPTO') {
                        item.type = 'CRYPTO';
                        hasChanges = true;
                    }
                }

                // 4. Force Refresh
                try {
                    const callDate = new Date(item.timestamp);
                    let entryPrice: number | null = null;
                    let currentPrice: number | null = null;
                    let usedType = type;

                    // A. Try to fetch Entry Price
                    // Use the stored type first
                    entryPrice = await getPrice(item.symbol, type, callDate);

                    // If failed, TRY SWAPPING TYPE
                    if (!entryPrice) {
                        const swappedType = type === 'CRYPTO' ? 'STOCK' : 'CRYPTO';
                        // Only try swap if not in the hardcoded crypto list
                        if (!['BTC', 'ETH', 'SOL'].includes(item.symbol.toUpperCase())) {
                            console.log(`[NeutralRefresh] Retry: Fetching ${item.symbol} as ${swappedType} (was ${type})...`);
                            const swappedPrice = await getPrice(item.symbol, swappedType, callDate);

                            if (swappedPrice) {
                                entryPrice = swappedPrice;
                                usedType = swappedType; // Update type to the working one
                                console.log(`[NeutralRefresh] Success: Found ${item.symbol} as ${swappedType}`);
                            } else {
                                //  console.log(`[NeutralRefresh] Failed to fetch Entry Price for ${item.symbol} (Checked both types)`);
                            }
                        }
                    }

                    // Update Entry Price if found
                    if (entryPrice) {
                        // Check if entry price changed significantly (or was missing)
                        if (!item.entryPrice || Math.abs(item.entryPrice - entryPrice) > 0.0001) {
                            item.entryPrice = entryPrice;
                            item.type = usedType; // Correct the type!
                            hasChanges = true;
                        }
                    }

                    // B. Refresh Current Price (Using the determined type)
                    // Even if we didn't find specific entry price (maybe using old one), try to get current price
                    if (item.entryPrice) {
                        currentPrice = await getPrice(item.symbol, usedType);

                        // If failed, try swap again for current price (just in case entry was old/hardcoded)
                        if (!currentPrice && usedType === type) { // Only if we haven't already swapped
                            const swappedType = type === 'CRYPTO' ? 'STOCK' : 'CRYPTO';
                            if (!['BTC', 'ETH', 'SOL'].includes(item.symbol.toUpperCase())) {
                                currentPrice = await getPrice(item.symbol, swappedType);
                                if (currentPrice) {
                                    usedType = swappedType;
                                    item.type = usedType;
                                    hasChanges = true;
                                }
                            }
                        }

                        if (currentPrice) {
                            const newPerformance = calculatePerformance(item.entryPrice, currentPrice, item.sentiment || 'BULLISH');
                            const isWin = newPerformance > 0;

                            // Update logic
                            const perfDiff = Math.abs(item.performance - newPerformance);

                            if (perfDiff > 0.001 || item.performance === 0) {
                                console.log(`[NeutralRefresh] UPDATING ${username} [${item.symbol}]: ${item.performance.toFixed(2)}% -> ${newPerformance.toFixed(2)}% ($${item.entryPrice.toFixed(2)} -> $${currentPrice.toFixed(2)})`);
                                item.currentPrice = currentPrice;
                                item.performance = newPerformance;
                                item.isWin = isWin;
                                item.type = usedType; // Ensure type is saved
                                hasChanges = true;
                                userUpdates++;

                                // Sync to global feed immediately
                                await updateGlobalRecentAnalysis(item);
                            }
                        } else {
                            // console.log(`[NeutralRefresh] Failed to fetch Current Price for ${item.symbol} (Type: ${usedType})`);
                        }
                    }

                } catch (e) {
                    console.error(`[NeutralRefresh] Exception for ${item.symbol}:`, e);
                }
            }
        }

        // 5. Save if changes
        if (hasChanges) {
            // Recalculate Stats for Profile
            let wins = 0;
            let losses = 0;
            let neutral = 0;

            for (const hItem of history) {
                if (Math.abs(hItem.performance) < 0.01) neutral++;
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
                lastAnalyzed: Date.now()
            });

            // Write back history
            await redis.del(historyKey);
            // Use pipeline for speed
            const pipeline = redis.pipeline();
            for (let i = history.length - 1; i >= 0; i--) { // Reverse to preserve order (LIFO)
                pipeline.lpush(historyKey, JSON.stringify(history[i]));
            }
            await pipeline.exec();

            totalUpdated += userUpdates;
        }
    }

    console.log(`✅ Neutral Refresh Complete.`);
    console.log(`- Scanned: ${totalScanned} calls`);
    console.log(`- Updated: ${totalUpdated} calls`);

    process.exit(0);
}

main();
