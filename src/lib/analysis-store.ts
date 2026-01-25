/**
 * @file analysis-store.ts
 * @description Redis storage layer for Since This Call
 * 
 * This module handles all Redis operations including:
 * - Storing and retrieving analyses (recent, user history)
 * - User profile management (wins/losses/badges)
 * - Ticker tracking for efficient price refresh
 * - Pump.fun price caching
 * 
 * Key Data Structures:
 * - `recent_analyses` (List): Recent 50 analyses for homepage
 * - `user:history:{username}` (List): Per-user analysis history
 * - `user:profile:{username}` (Hash): User stats and badges
 * - `tracked_tickers` (Set): All unique tickers being tracked
 * - `ticker_index:{TYPE:SYMBOL}` (Set): Maps ticker to analyses
 * 
 * @see price-refresher.ts for batch price updates using ticker index
 */
import { getRedisClient } from './redis-client';
import { z } from 'zod';
import { Redis } from '@upstash/redis';

// Primary Redis client
const redis = getRedisClient();

// Secondary Redis client (Production) - Only used for Dual-Write
// We instantiate this directly as Upstash client since it's strictly for cloud URL
const redisProd = process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL
    ? new Redis({
        url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL,
        token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
    })
    : null;

/**
 * Executes a function on both primary and secondary (if available) Redis clients.
 */
async function dualWrite<T>(fn: (r: Redis) => Promise<T>): Promise<T> {
    const primaryResult = await fn(redis as Redis);
    if (redisProd) {
        // Fire and forget secondary write
        fn(redisProd).catch(e => console.error('[AnalysisStore] Secondary Dual-Write Failed:', e));
    }
    return primaryResult;
}

const RECENT_KEY = 'recent_analyses';
const MAX_STORED = 50;

// Ticker Tracking (for optimized price refresh)
const TRACKED_TICKERS_KEY = 'tracked_tickers';
const TICKER_INDEX_PREFIX = 'ticker_index:';

/**
 * Get the ticker key for an analysis.
 * Format: "CRYPTO:BTC", "STOCK:AAPL", or "CA:abc123..." for contract addresses
 */
function getTickerKey(analysis: { symbol: string; type?: string; contractAddress?: string }): string {
    if (analysis.contractAddress && analysis.contractAddress.length > 10) {
        return `CA:${analysis.contractAddress}`;
    }
    const type = analysis.type || 'CRYPTO';
    return `${type}:${analysis.symbol.toUpperCase()}`;
}

/**
 * Add an analysis to the ticker index for efficient lookup during refresh.
 */
export async function trackTicker(analysis: StoredAnalysis): Promise<void> {
    try {
        const tickerKey = getTickerKey(analysis);
        const indexKey = `${TICKER_INDEX_PREFIX}${tickerKey}`;
        const analysisRef = `${analysis.username.toLowerCase()}:${analysis.id}`;

        await dualWrite(async (r) => {
            const pipe = r.pipeline();
            pipe.sadd(TRACKED_TICKERS_KEY, tickerKey);
            pipe.sadd(indexKey, analysisRef);
            await pipe.exec();
        });
    } catch (error) {
        console.error('[AnalysisStore] Failed to track ticker:', error);
    }
}

/**
 * Remove an analysis from the ticker index.
 */
export async function untrackTicker(analysis: StoredAnalysis): Promise<void> {
    try {
        const tickerKey = getTickerKey(analysis);
        const indexKey = `${TICKER_INDEX_PREFIX}${tickerKey}`;
        const analysisRef = `${analysis.username.toLowerCase()}:${analysis.id}`;

        await dualWrite(async (r) => {
            await r.srem(indexKey, analysisRef);
            const remaining = await r.scard(indexKey);
            if (remaining === 0) {
                await r.srem(TRACKED_TICKERS_KEY, tickerKey);
                await r.del(indexKey);
            }
        });
    } catch (error) {
        console.error('[AnalysisStore] Failed to untrack ticker:', error);
    }
}

/**
 * Get all tracked tickers for efficient price refresh.
 */
export async function getTrackedTickers(): Promise<string[]> {
    try {
        return await redis.smembers(TRACKED_TICKERS_KEY) as string[];
    } catch (error) {
        console.error('[AnalysisStore] Failed to get tracked tickers:', error);
        return [];
    }
}

/**
 * Get all analysis references for a ticker.
 * Returns array of "username:tweetId" strings.
 */
export async function getTickerAnalyses(tickerKey: string): Promise<string[]> {
    try {
        const indexKey = `${TICKER_INDEX_PREFIX}${tickerKey}`;
        return await redis.smembers(indexKey) as string[];
    } catch (error) {
        console.error('[AnalysisStore] Failed to get ticker analyses:', error);
        return [];
    }
}

export interface StoredAnalysis {
    id: string;          // Tweet ID
    username: string;
    author: string;
    avatar?: string;
    symbol: string;
    sentiment: 'BULLISH' | 'BEARISH';
    performance: number;
    isWin: boolean;
    timestamp: number;
    entryPrice?: number; // Price at tweet time
    currentPrice?: number; // Price at analysis time (or last update)
    type?: 'CRYPTO' | 'STOCK';
    contractAddress?: string; // For pump.fun/DexScreener tokens
    // Context Engine fields
    ticker?: string;
    action?: 'BUY' | 'SELL';
    confidence_score?: number;
    timeframe?: 'SHORT_TERM' | 'LONG_TERM' | 'UNKNOWN';
    is_sarcasm?: boolean;
    reasoning?: string;
    warning_flags?: string[];
    // Optional metadata
    tweetUrl?: string;
    text?: string;
}

// Zod schema for input validation
export const StoredAnalysisSchema = z.object({
    id: z.string(),
    username: z.string(),
    author: z.string(),
    avatar: z.string().optional(),
    symbol: z.string(),
    sentiment: z.enum(['BULLISH', 'BEARISH']),
    performance: z.number(),
    isWin: z.boolean(),
    timestamp: z.number(),
    entryPrice: z.number().optional(),
    currentPrice: z.number().optional(),
    type: z.enum(['CRYPTO', 'STOCK']).optional(),
    contractAddress: z.string().optional(),
    ticker: z.string().optional(),
    action: z.enum(['BUY', 'SELL']).optional(),
    confidence_score: z.number().optional(),
    timeframe: z.enum(['SHORT_TERM', 'LONG_TERM', 'UNKNOWN']).optional(),
    is_sarcasm: z.boolean().optional(),
    reasoning: z.string().optional(),
    warning_flags: z.array(z.string()).optional(),
});

export async function addAnalysis(analysis: StoredAnalysis): Promise<void> {
    try {
        // We must fetch from primary to perform consistency logic
        const currentData = await redis.lrange(RECENT_KEY, 0, -1);
        let items: StoredAnalysis[] = currentData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        items = items.filter(item => item.id !== analysis.id);
        items.unshift(analysis);

        if (items.length > MAX_STORED) {
            items = items.slice(0, MAX_STORED);
        }

        const serializedItems = items.map(item => JSON.stringify(item));

        // Use dualWrite for persistence
        await dualWrite(async (r) => {
            await r.del(RECENT_KEY);
            const pipeline = r.pipeline();
            for (const s of serializedItems) {
                pipeline.rpush(RECENT_KEY, s);
            }
            await pipeline.exec();
        });

    } catch (error) {
        console.error('[AnalysisStore] Failed to add analysis:', error);
    }
}

export async function getRecentAnalyses(limit: number = 20): Promise<StoredAnalysis[]> {
    try {
        const data = await redis.lrange(RECENT_KEY, 0, limit - 1);
        return data.map((item: any) => {
            // Handle both string and already-parsed objects
            if (typeof item === 'string') {
                return JSON.parse(item);
            }
            return item;
        });
    } catch (error) {
        console.error('[AnalysisStore] Failed to get recent analyses:', error);
        return [];
    }
}

export async function getAnalysisCount(): Promise<number> {
    try {
        return await redis.llen(RECENT_KEY);
    } catch (error) {
        console.error('[AnalysisStore] Failed to get count:', error);
        return 0;
    }
}

export async function getRandomAnalysis(): Promise<StoredAnalysis | null> {
    try {
        const count = await redis.llen(RECENT_KEY);
        if (count === 0) return null;

        const randomIndex = Math.floor(Math.random() * count);
        const item = await redis.lindex(RECENT_KEY, randomIndex);

        if (!item) return null;

        if (typeof item === 'string') {
            return JSON.parse(item);
        }
        return item as StoredAnalysis;
    } catch (error) {
        console.error('[AnalysisStore] Failed to get random:', error);
        return null;
    }
}

// ============================================
// User Profiles
// ============================================

const USER_PROFILE_PREFIX = 'user:profile:';
const USER_HISTORY_PREFIX = 'user:history:';

export interface UserProfile {
    username: string;
    avatar: string;
    totalAnalyses: number;
    wins: number;
    losses: number;
    neutral: number;
    winRate: number;
    lastAnalyzed: number;
    isVerified: boolean;
}

const ALL_USERS_KEY = 'all_users';

export async function updateUserProfile(analysis: StoredAnalysis): Promise<void> {
    try {
        const lowerUser = analysis.username.toLowerCase();
        const profileKey = `${USER_PROFILE_PREFIX}${lowerUser}`;
        const historyKey = `${USER_HISTORY_PREFIX}${lowerUser}`;

        // Track user in global set
        await redis.sadd(ALL_USERS_KEY, lowerUser);

        // Get current history
        const historyData = await redis.lrange(historyKey, 0, -1);
        let history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        // Check if tweet already exists
        const existingIndex = history.findIndex((h: StoredAnalysis) => h.id === analysis.id);

        if (existingIndex !== -1) {
            // Update existing entry
            history[existingIndex] = analysis;
        } else {
            // Add new entry (prepend)
            history.unshift(analysis);

            // Track the ticker for optimized price refresh
            await trackTicker(analysis);
        }

        // Limit history size (keep top 100 most recent unique calls)
        if (history.length > 100) {
            history = history.slice(0, 100);
        }

        // Recalculate Stats from History
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

        // Get existing profile to preserve verification
        const existingProfile = await redis.hgetall(profileKey);

        // Persist via Dual-Write
        await dualWrite(async (r) => {
            // Update Hash
            await r.hset(profileKey, {
                username: analysis.username,
                avatar: analysis.avatar || '',
                totalAnalyses: total,
                wins,
                losses,
                neutral,
                winRate,
                lastAnalyzed: Date.now(),
                isVerified: (existingProfile as any)?.isVerified === 'true' || (existingProfile as any)?.isVerified === true,
            });

            // Replace History List
            await r.del(historyKey);
            if (history.length > 0) {
                // Pipeline the history pushes
                const p = r.pipeline();
                for (let i = history.length - 1; i >= 0; i--) {
                    p.lpush(historyKey, JSON.stringify(history[i]));
                }
                await p.exec();
            }
        });

    } catch (error) {
        console.error('[AnalysisStore] Failed to update user profile:', error);
    }
}

export async function recalculateUserProfile(username: string): Promise<void> {
    try {
        const lowerUser = username.toLowerCase();
        const profileKey = `${USER_PROFILE_PREFIX}${lowerUser}`;
        const historyKey = `${USER_HISTORY_PREFIX}${lowerUser}`;

        // Get current history
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

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

        // Get existing avatar/username from profile to preserve them if possible
        // (or take from the first history item if profile empty)
        const existingProfile = await redis.hgetall(profileKey);
        let avatar = (existingProfile as any)?.avatar || '';
        let displayUsername = (existingProfile as any)?.username || username;

        if (!avatar && history.length > 0) {
            avatar = history[0].avatar || '';
            displayUsername = history[0].username;
        }

        // Persist via Dual-Write
        await dualWrite(async (r) => {
            await r.hset(profileKey, {
                username: displayUsername,
                avatar: avatar,
                totalAnalyses: total,
                wins,
                losses,
                neutral,
                winRate,
                lastAnalyzed: Date.now(),
                isVerified: (existingProfile as any)?.isVerified === 'true' || (existingProfile as any)?.isVerified === true,
            });
        });

        console.log(`[AnalysisStore] Synced profile for ${username}: ${total} calls (${wins}W/${losses}L)`);

    } catch (error) {
        console.error('[AnalysisStore] Failed to recalculate user profile:', error);
    }
}

export async function getUserProfile(username: string): Promise<{ profile: UserProfile | null, history: StoredAnalysis[] }> {
    try {
        const lowerUser = username.toLowerCase();
        const profileKey = `${USER_PROFILE_PREFIX}${lowerUser}`;
        const historyKey = `${USER_HISTORY_PREFIX}${lowerUser}`;

        const [profileData, historyData] = await Promise.all([
            redis.hgetall(profileKey),
            redis.lrange(historyKey, 0, -1)
        ]);

        if (!profileData || Object.keys(profileData).length === 0) {
            return { profile: null, history: [] };
        }

        const history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        const safeProfile = profileData as Record<string, string>;

        return {
            profile: {
                ...safeProfile,
                totalAnalyses: parseInt(safeProfile.totalAnalyses || '0'),
                wins: parseInt(safeProfile.wins || '0'),
                losses: parseInt(safeProfile.losses || '0'),
                neutral: parseInt(safeProfile.neutral || '0'),
                winRate: parseFloat(safeProfile.winRate || '0'),
                lastAnalyzed: parseInt(safeProfile.lastAnalyzed || '0'),
                isVerified: safeProfile.isVerified === 'true' || safeProfile.isVerified === (true as any),
            } as UserProfile,
            history
        };
    } catch (error) {
        console.error('[AnalysisStore] Failed to get user profile:', error);
        return { profile: null, history: [] };
    }
}

export async function getAllUserProfiles(): Promise<UserProfile[]> {
    try {
        const users = await redis.smembers(ALL_USERS_KEY);
        if (users.length === 0) return [];

        const pipeline = redis.pipeline();
        users.forEach((user) => pipeline.hgetall(`${USER_PROFILE_PREFIX}${user}`));

        const results = await pipeline.exec();

        const profiles: UserProfile[] = [];
        results.forEach((res) => {
            // Pipeline results are now normalized by LocalRedisWrapper proxy locally,
            // and native Upstash client works purely. No manual unwrapping needed.
            const data = res;

            if (data && Object.keys(data as object).length > 0) {
                const safeProfile = data as Record<string, string>;

                // Ensure username exists (fallback to generic if missing in hash)
                if (!safeProfile.username) return;

                profiles.push({
                    username: safeProfile.username,
                    avatar: safeProfile.avatar || '',
                    totalAnalyses: parseInt(safeProfile.totalAnalyses || '0'),
                    wins: parseInt(safeProfile.wins || '0'),
                    losses: parseInt(safeProfile.losses || '0'),
                    neutral: parseInt(safeProfile.neutral || '0'),
                    winRate: parseFloat(safeProfile.winRate || '0'),
                    lastAnalyzed: parseInt(safeProfile.lastAnalyzed || '0'),
                    isVerified: safeProfile.isVerified === 'true' || safeProfile.isVerified === (true as any),
                } as UserProfile);
            }
        });

        // Sort by Total Analyses Descending
        return profiles.sort((a, b) => b.totalAnalyses - a.totalAnalyses);
    } catch (error) {
        console.error('[AnalysisStore] Failed to get all profiles:', error);
        return [];
    }
}

// Re-export existing remover for compatibility, or update it to remove from profile too?
// Removing individual analysis from profile history is hard (requires scanning list).
// For now, assume removal is rare/admin only.

export async function removeAnalysisByTweetId(tweetId: string): Promise<boolean> {
    try {
        // Get all items
        const allItems = await redis.lrange(RECENT_KEY, 0, -1);

        // Filter out the item with matching tweet ID
        const filtered = allItems.filter((item: any) => {
            const parsed = typeof item === 'string' ? JSON.parse(item) : item;
            return parsed.id !== tweetId;
        });

        if (filtered.length === allItems.length) {
            console.log('[AnalysisStore] Tweet ID not found:', tweetId);
            return false;
        }

        // Clear and repopulate the list
        await redis.del(RECENT_KEY);
        if (filtered.length > 0) {
            // rpush to maintain order (oldest first, then we'll reverse)
            for (const item of filtered.reverse()) {
                await redis.lpush(RECENT_KEY, typeof item === 'string' ? item : JSON.stringify(item));
            }
        }

        console.log('[AnalysisStore] Removed tweet:', tweetId);
        return true;
    } catch (error) {
        console.error('[AnalysisStore] Failed to remove analysis:', error);
        return false;
    }
}

// ============================================
// Pump.fun Price History Storage
// ============================================

const PUMPFUN_PRICE_PREFIX = 'pumpfun:price:';

export interface StoredPumpfunPrice {
    price: number;
    symbol: string;
    timestamp: number;
}

/**
 * Store first-seen price for a pump.fun token.
 * Only stores if no existing price record exists (preserves original price).
 */
export async function storePumpfunPrice(
    contractAddress: string,
    price: number,
    symbol: string
): Promise<boolean> {
    try {
        const key = `${PUMPFUN_PRICE_PREFIX}${contractAddress}`;

        const payload = JSON.stringify({
            price,
            symbol,
            timestamp: Date.now(),
        } as StoredPumpfunPrice);

        const results = await dualWrite(async (r) => {
            return await r.setnx(key, payload);
        });

        return results === 1;
    } catch (error) {
        console.error('[AnalysisStore] Failed to store pumpfun price:', error);
        return false;
    }
}

/**
 * Get stored historical price for a pump.fun token.
 */
export async function getPumpfunPrice(contractAddress: string): Promise<StoredPumpfunPrice | null> {
    try {
        const key = `${PUMPFUN_PRICE_PREFIX}${contractAddress}`;
        const data = await redis.get(key);

        if (!data) return null;

        if (typeof data === 'string') {
            return JSON.parse(data);
        }
        return data as StoredPumpfunPrice;
    } catch (error) {
        console.error('[AnalysisStore] Failed to get pumpfun price:', error);
        return null;
    }
}
