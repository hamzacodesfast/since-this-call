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
