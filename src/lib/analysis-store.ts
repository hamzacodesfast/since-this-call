import { Redis } from '@upstash/redis';
import { z } from 'zod';

// Initialize Upstash Redis client
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const RECENT_KEY = 'recent_analyses';
const MAX_STORED = 50;

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
});

export async function addAnalysis(analysis: StoredAnalysis): Promise<void> {
    try {
        // Add to beginning of list (lpush)
        await redis.lpush(RECENT_KEY, JSON.stringify(analysis));

        // Trim to max size
        await redis.ltrim(RECENT_KEY, 0, MAX_STORED - 1);
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

        // Update Hash
        await redis.hset(profileKey, {
            username: analysis.username,
            avatar: analysis.avatar || '',
            totalAnalyses: total,
            wins,
            losses,
            neutral,
            winRate,
            lastAnalyzed: Date.now(),
        });

        // Replace History List
        await redis.del(historyKey);
        if (history.length > 0) {
            for (let i = history.length - 1; i >= 0; i--) {
                await redis.lpush(historyKey, JSON.stringify(history[i]));
            }
        }

    } catch (error) {
        console.error('[AnalysisStore] Failed to update user profile:', error);
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
        results.forEach((result) => {
            if (result && Object.keys(result as object).length > 0) {
                const safeProfile = result as Record<string, string>;
                profiles.push({
                    ...safeProfile,
                    totalAnalyses: parseInt(safeProfile.totalAnalyses || '0'),
                    wins: parseInt(safeProfile.wins || '0'),
                    losses: parseInt(safeProfile.losses || '0'),
                    neutral: parseInt(safeProfile.neutral || '0'),
                    winRate: parseFloat(safeProfile.winRate || '0'),
                    lastAnalyzed: parseInt(safeProfile.lastAnalyzed || '0'),
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

        // Only set if key doesn't exist (NX = Not eXists)
        const result = await redis.setnx(key, JSON.stringify({
            price,
            symbol,
            timestamp: Date.now(),
        } as StoredPumpfunPrice));

        return result === 1; // Returns 1 if set, 0 if already exists
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
