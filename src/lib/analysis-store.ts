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
 * - `ticker:profile:{ticker}` (Hash): Ticker stats and badges
 * - `tracked_tickers` (Set): All unique tickers being tracked
 * - `ticker_index:{TYPE:SYMBOL}` (Set): Maps ticker to analyses
 *
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
const redisProd = (process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL && process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL.startsWith('https'))
    ? new Redis({
        url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL,
        token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
    })
    : null;

/**
 * Executes a function on both primary and secondary (if available) Redis clients.
 * IMPORTANT: Both writes are awaited to prevent race conditions that can cause
 * duplicate list entries when del+lpush operations interleave.
 */
export async function dualWrite<T>(fn: (r: Redis) => Promise<T>): Promise<T> {
    const primaryResult = await fn(redis as Redis);
    if (redisProd) {
        try {
            await fn(redisProd);
        } catch (e) {
            console.error('[AnalysisStore] Secondary Dual-Write Error:', e);
        }
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
function getTickerKey(analysis: { symbol: string; type?: string }): string {
    const symbol = analysis.symbol.toUpperCase();
    const type = analysis.type || 'CRYPTO';
    return `${type}:${symbol}`;
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
            // Use ZSET for time-sorted access
            pipe.zadd(indexKey, { score: analysis.timestamp, member: analysisRef });
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
            await r.zrem(indexKey, analysisRef);
            const remaining = await r.zcard(indexKey);
            if (remaining === 0) {
                await r.srem(TRACKED_TICKERS_KEY, tickerKey);
                await r.del(indexKey);
            }
        });
    } catch (error) {
        console.error('[AnalysisStore] Failed to untrack ticker:', error);
    }
}

// ============================================
// Ticker Profiles
// ============================================

const TICKER_PROFILE_PREFIX = 'ticker:profile:';

export interface TickerProfile {
    symbol: string;
    type: 'CRYPTO' | 'STOCK';
    totalAnalyses: number;
    wins: number;
    losses: number;
    neutral: number;
    bullish: number;
    bearish: number;
    winRate: number;
    lastAnalyzed: number;
}

export async function updateTickerProfile(tickerKey: string): Promise<void> {
    try {
        const indexKey = `${TICKER_INDEX_PREFIX}${tickerKey}`;
        const analysisRefs = await redis.zrange(indexKey, 0, -1) as string[];

        if (analysisRefs.length === 0) {
            await dualWrite(async (r) => {
                await r.del(`${TICKER_PROFILE_PREFIX}${tickerKey}`);
            });
            return;
        }

        let wins = 0;
        let losses = 0;
        let neutral = 0;
        let bullish = 0;
        let bearish = 0;
        let lastAnalyzed = 0;

        // Group by username to minimize history fetches
        const userMap = new Map<string, string[]>();
        for (const ref of analysisRefs) {
            const [username, id] = ref.split(':');
            if (!userMap.has(username)) userMap.set(username, []);
            userMap.get(username)!.push(id);
        }

        const usernames = Array.from(userMap.keys());
        const pipeline = redis.pipeline();
        for (const u of usernames) {
            pipeline.lrange(`${USER_HISTORY_PREFIX}${u}`, 0, -1);
        }
        
        // Execute pipeline. Our wrapper returns results directly as an array of data.
        const histories = await pipeline.exec();

        for (let i = 0; i < histories.length; i++) {
            const username = usernames[i];
            const targetIds = new Set(userMap.get(username));
            const history = histories[i] as any[];

            if (Array.isArray(history)) {
                for (const item of history) {
                    const a = typeof item === 'string' ? JSON.parse(item) : item;
                    if (targetIds.has(a.id)) {
                        if (Math.abs(a.performance) < 0.01) neutral++;
                        else if (a.isWin) wins++;
                        else losses++;

                        if (a.sentiment === 'BULLISH') bullish++;
                        else if (a.sentiment === 'BEARISH') bearish++;

                        if (a.timestamp > lastAnalyzed) lastAnalyzed = a.timestamp;
                    }
                }
            }
        }

        const parts = tickerKey.split(':');
        const stats = {
            symbol: parts[1] || tickerKey,
            type: parts[0] as any,
            totalAnalyses: analysisRefs.length,
            wins,
            losses,
            neutral,
            bullish,
            bearish,
            winRate: analysisRefs.length > 0 ? (wins / analysisRefs.length) * 100 : 0,
            lastAnalyzed
        };

        await dualWrite(async (r) => {
            await r.hset(`${TICKER_PROFILE_PREFIX}${tickerKey}`, stats as any);
        });
        
    } catch (error) {
        console.error('[AnalysisStore] Failed to update ticker profile:', error);
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
export async function getTickerAnalyses(tickerKey: string, limit: number = -1): Promise<string[]> {
    try {
        const indexKey = `${TICKER_INDEX_PREFIX}${tickerKey}`;
        // Use ZSET for time-sorted access (newest first)
        const stop = limit === -1 ? -1 : limit - 1;
        return await redis.zrange(indexKey, 0, stop, { rev: true }) as string[];
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
            const pipeline = r.pipeline();
            pipeline.del(RECENT_KEY);
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

/**
 * Update a specific analysis in the recent_analyses list if it exists.
 * Used for maintaining consistency when prices/stats are refreshed.
 */
export async function updateGlobalRecentAnalysis(updatedItem: StoredAnalysis): Promise<void> {
    try {
        // Fetch ALL recent items (to find the one to update)
        const currentData = await redis.lrange(RECENT_KEY, 0, -1);
        let items: StoredAnalysis[] = currentData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        const index = items.findIndex(item => item.id === updatedItem.id);

        if (index !== -1) {
            // Update the item
            items[index] = { ...items[index], ...updatedItem };

            const serializedItems = items.map(item => JSON.stringify(item));

            // Persist
            await dualWrite(async (r) => {
                const pipeline = r.pipeline();
                pipeline.del(RECENT_KEY);
                for (const s of serializedItems) {
                    pipeline.rpush(RECENT_KEY, s);
                }
                await pipeline.exec();
            });
            // console.log(`[AnalysisStore] Updated global recent analysis for ${updatedItem.id}`);
        }
    } catch (error) {
        console.error('[AnalysisStore] Failed to update global recent analysis:', error);
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
const GLOBAL_ANALYSES_ZSET = 'global:analyses:timestamp';

export async function updateUserProfile(analysis: StoredAnalysis): Promise<void> {
    try {
        const lowerUser = analysis.username.toLowerCase();
        const profileKey = `${USER_PROFILE_PREFIX}${lowerUser}`;
        const historyKey = `${USER_HISTORY_PREFIX}${lowerUser}`;
        const analysisRef = `${lowerUser}:${analysis.id}`;

        // 1. Global Indexes (Always Update)
        await dualWrite(async (r) => {
            await r.sadd(ALL_USERS_KEY, lowerUser);
            await r.zadd(GLOBAL_ANALYSES_ZSET, { score: analysis.timestamp, member: analysisRef });
        });

        // 2. Fetch Resources needed
        // We fetch existing profile FIRST to do incremental updates
        const existingProfile = await redis.hgetall(profileKey) as any;

        // Fetch history to manage the list (add/remove/cap)
        const historyData = await redis.lrange(historyKey, 0, -1);
        let history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        // 3. Determine if New or Update
        const existingIndex = history.findIndex((h: StoredAnalysis) => h.id === analysis.id);
        const isNew = existingIndex === -1;
        let oldAnalysis: StoredAnalysis | undefined;

        if (!isNew) {
            oldAnalysis = history[existingIndex];
            // Remove old for list consistency (bubble to top)
            history.splice(existingIndex, 1);
        }

        // Add New to List
        history.unshift(analysis);

        // 4. Update Ticker Stats (Side Effect)
        if (!isNew && oldAnalysis) {
            await updateTickerStats(analysis, false, oldAnalysis);
        } else {
            await trackTicker(analysis);
            await updateTickerStats(analysis, true);
        }

        // 5. Calculate New Profile Stats (INCREMENTAL)
        let stats = {
            totalAnalyses: parseInt(existingProfile?.totalAnalyses || '0'),
            wins: parseInt(existingProfile?.wins || '0'),
            losses: parseInt(existingProfile?.losses || '0'),
            neutral: parseInt(existingProfile?.neutral || '0'),
            winRate: parseFloat(existingProfile?.winRate || '0'),
        };

        // Initialize if empty/NaN (safety)
        if (isNaN(stats.totalAnalyses)) stats.totalAnalyses = 0;
        if (isNaN(stats.wins)) stats.wins = 0;
        if (isNaN(stats.losses)) stats.losses = 0;
        if (isNaN(stats.neutral)) stats.neutral = 0;

        // Apply Differential
        if (!isNew && oldAnalysis) {
            // Remove Old Stats
            if (Math.abs(oldAnalysis.performance) < 0.01) stats.neutral--;
            else if (oldAnalysis.isWin) stats.wins--;
            else stats.losses--;

            stats.totalAnalyses--; // Temporarily decrement to re-add correctly (cleaner logic)
        }

        // Add New Stats
        if (Math.abs(analysis.performance) < 0.01) stats.neutral++;
        else if (analysis.isWin) stats.wins++;
        else stats.losses++;

        stats.totalAnalyses++;

        // Recalc Win Rate (Cumulative)
        // Note: We use the cumulative totals, so this remains accurate > 100 items.
        // Win Rate = Wins / Total (excluding Neutral? Or Total? Standard is Total usually, or Total Decided)
        // Our existing logic was Wins / Total (length).
        // Let's stick to Wins / Total.
        stats.winRate = stats.totalAnalyses > 0 ? (stats.wins / stats.totalAnalyses) * 100 : 0;

        // 6. Persistence
        await dualWrite(async (r) => {
            // Update Stats in Hash
            await r.hset(profileKey, {
                username: analysis.username,
                avatar: analysis.avatar || existingProfile?.avatar || '',
                totalAnalyses: stats.totalAnalyses,
                wins: stats.wins,
                losses: stats.losses,
                neutral: stats.neutral,
                winRate: stats.winRate,
                lastAnalyzed: Date.now(),
                isVerified: existingProfile?.isVerified === 'true' || existingProfile?.isVerified === true,
            });

            // Update History List (Capped at 100)
            const p = r.pipeline();
            p.del(historyKey);
            if (history.length > 0) {
                for (let i = history.length - 1; i >= 0; i--) {
                    p.lpush(historyKey, JSON.stringify(history[i]));
                }
            }
            await p.exec();
        });

    } catch (error) {
        console.error('[AnalysisStore] Failed to update user profile:', error);
    }
}

/**
 * Incrementally update ticker profile stats.
 * This is a lightweight alternative to full recalculation.
 */
export async function updateTickerStats(analysis: StoredAnalysis, isNew: boolean, oldAnalysis?: StoredAnalysis): Promise<void> {
    try {
        const tickerKey = getTickerKey(analysis);
        const profileKey = `${TICKER_PROFILE_PREFIX}${tickerKey}`;

        // Get existing profile
        const existing = await redis.hgetall(profileKey) as any; // Cast to any to handle type

        let stats = {
            symbol: analysis.symbol.toUpperCase(),
            type: analysis.type || 'CRYPTO',
            totalAnalyses: parseInt(existing?.totalAnalyses || '0'),
            wins: parseInt(existing?.wins || '0'),
            losses: parseInt(existing?.losses || '0'),
            neutral: parseInt(existing?.neutral || '0'),
            bullish: parseInt(existing?.bullish || '0'),
            bearish: parseInt(existing?.bearish || '0'),
            winRate: parseFloat(existing?.winRate || '0'),
            lastAnalyzed: parseInt(existing?.lastAnalyzed || '0')
        };

        // If updating existing analysis, remove old stats first
        if (!isNew && oldAnalysis) {
            if (Math.abs(oldAnalysis.performance) < 0.01) stats.neutral--;
            else if (oldAnalysis.isWin) stats.wins--;
            else stats.losses--;

            if (oldAnalysis.sentiment === 'BULLISH') stats.bullish--;
            else if (oldAnalysis.sentiment === 'BEARISH') stats.bearish--;

            stats.totalAnalyses--;
        }

        // Add new stats
        if (Math.abs(analysis.performance) < 0.01) stats.neutral++;
        else if (analysis.isWin) stats.wins++;
        else stats.losses++;

        if (analysis.sentiment === 'BULLISH') stats.bullish++;
        else if (analysis.sentiment === 'BEARISH') stats.bearish++;

        stats.totalAnalyses++;
        stats.lastAnalyzed = Date.now();

        // Recalc Win Rate
        stats.winRate = stats.totalAnalyses > 0 ? (stats.wins / stats.totalAnalyses) * 100 : 0;

        // Persist
        await dualWrite(async (r) => {
            await r.hset(profileKey, stats as any);
        });

    } catch (error) {
        console.error('[AnalysisStore] Failed to update ticker stats:', error);
    }
}

/**
 * Remove an analysis from ticker stats.
 */
export async function removeTickerStats(analysis: StoredAnalysis): Promise<void> {
    try {
        const tickerKey = getTickerKey(analysis);
        const profileKey = `${TICKER_PROFILE_PREFIX}${tickerKey}`;

        // Get existing profile
        const existing = await redis.hgetall(profileKey) as any;

        if (!existing) return;

        let stats = {
            symbol: analysis.symbol.toUpperCase(),
            type: analysis.type || 'CRYPTO',
            totalAnalyses: parseInt(existing.totalAnalyses || '0'),
            wins: parseInt(existing.wins || '0'),
            losses: parseInt(existing.losses || '0'),
            neutral: parseInt(existing.neutral || '0'),
            bullish: parseInt(existing.bullish || '0'),
            bearish: parseInt(existing.bearish || '0'),
            winRate: parseFloat(existing.winRate || '0'),
            lastAnalyzed: parseInt(existing.lastAnalyzed || '0')
        };

        // Remove stats
        if (Math.abs(analysis.performance) < 0.01) stats.neutral--;
        else if (analysis.isWin) stats.wins--;
        else stats.losses--;

        if (analysis.sentiment === 'BULLISH') stats.bullish--;
        else if (analysis.sentiment === 'BEARISH') stats.bearish--;

        stats.totalAnalyses--;

        // Recalc Win Rate
        stats.winRate = stats.totalAnalyses > 0 ? (stats.wins / stats.totalAnalyses) * 100 : 0;

        // Persist
        await dualWrite(async (r) => {
            if (stats.totalAnalyses <= 0) {
                await r.del(profileKey);
            } else {
                await r.hset(profileKey, stats as any);
            }
        });

    } catch (error) {
        console.error('[AnalysisStore] Failed to remove ticker stats:', error);
    }
}

export async function getAllTickerProfiles(
    options?: { page?: number; limit?: number; search?: string }
): Promise<{ profiles: TickerProfile[]; hasMore: boolean }> {
    try {
        const tickers = await redis.smembers(TRACKED_TICKERS_KEY) as string[];
        if (tickers.length === 0) return { profiles: [], hasMore: false };

        // 1. Filter by search term before parsing full profiles
        let filteredTickers = tickers;
        if (options?.search) {
            const term = options.search.toLowerCase();
            // tickers are format TYPE:SYMBOL (e.g. CRYPTO:BTC)
            filteredTickers = tickers.filter((t: string) => {
                const parts = t.split(':');
                const symbol = parts.length > 1 ? parts[1] : t;
                return symbol.toLowerCase().includes(term);
            });
        }

        if (filteredTickers.length === 0) return { profiles: [], hasMore: false };

        // 2. Fetch lightweight profiles first
        const pipeline = redis.pipeline();
        filteredTickers.forEach((t) => pipeline.hgetall(`${TICKER_PROFILE_PREFIX}${t}`));

        const results = await pipeline.exec();

        const allProfiles: TickerProfile[] = [];
        results.forEach((res) => {
            const data = res as any;
            if (data && data.symbol) {
                allProfiles.push({
                    symbol: data.symbol,
                    type: data.type as any,
                    totalAnalyses: parseInt(data.totalAnalyses || '0'),
                    wins: parseInt(data.wins || '0'),
                    losses: parseInt(data.losses || '0'),
                    neutral: parseInt(data.neutral || '0'),
                    bullish: parseInt(data.bullish || '0'),
                    bearish: parseInt(data.bearish || '0'),
                    winRate: parseFloat(data.winRate || '0'),
                    lastAnalyzed: parseInt(data.lastAnalyzed || '0')
                });
            }
        });

        // 3. Sort by Total Analyses Descending
        allProfiles.sort((a, b) => b.totalAnalyses - a.totalAnalyses);

        // 4. Apply Pagination
        const page = Math.max(1, options?.page || 1);
        const limit = Math.max(1, options?.limit || 30);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        const paginatedProfiles = allProfiles.slice(startIndex, endIndex);
        const hasMore = endIndex < allProfiles.length;

        return {
            profiles: paginatedProfiles,
            hasMore
        };
    } catch (error) {
        console.error('[AnalysisStore] Failed to get paginated ticker profiles:', error);
        return { profiles: [], hasMore: false };
    }
}

export async function getTickerProfile(symbol: string, type: 'CRYPTO' | 'STOCK' = 'CRYPTO'): Promise<TickerProfile | null> {
    try {
        const cleanSymbol = symbol.toUpperCase();
        const tickerKey = `${type}:${cleanSymbol}`;

        const profile = await redis.hgetall(`${TICKER_PROFILE_PREFIX}${tickerKey}`) as any;
        if (!profile || !profile.symbol) return null;

        return {
            symbol: profile.symbol,
            type: profile.type as any,
            totalAnalyses: parseInt(profile.totalAnalyses || '0'),
            wins: parseInt(profile.wins || '0'),
            losses: parseInt(profile.losses || '0'),
            neutral: parseInt(profile.neutral || '0'),
            bullish: parseInt(profile.bullish || '0'),
            bearish: parseInt(profile.bearish || '0'),
            winRate: parseFloat(profile.winRate || '0'),
            lastAnalyzed: parseInt(profile.lastAnalyzed || '0')
        };
    } catch (error) {
        console.error('[AnalysisStore] Failed to get ticker profile:', error);
        return null;
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

export async function getAllUserProfiles(
    options?: { page?: number; limit?: number; search?: string }
): Promise<{ profiles: UserProfile[]; hasMore: boolean }> {
    try {
        const users = await redis.smembers(ALL_USERS_KEY) as string[];
        if (users.length === 0) return { profiles: [], hasMore: false };

        // 1. Filter by search term before parsing full profiles
        let filteredUsers = users;
        if (options?.search) {
            const term = options.search.toLowerCase();
            filteredUsers = users.filter((u: string) => u.toLowerCase().includes(term));
        }

        if (filteredUsers.length === 0) return { profiles: [], hasMore: false };

        // 2. Fetch lightweight profiles first to sort them by totalAnalyses (since Redis SMEMBERS is unsorted)
        // Optimization: In a production scale system with 100k+ users, we would use a ZSET for sorting directly in Redis.
        // For now, pipelining all filtered HGETALLs is still relatively fast.
        const pipeline = redis.pipeline();
        filteredUsers.forEach((user) => pipeline.hgetall(`${USER_PROFILE_PREFIX}${user}`));

        const results = await pipeline.exec();

        const allProfiles: UserProfile[] = [];
        results.forEach((res) => {
            const data = res;
            if (data && Object.keys(data as object).length > 0) {
                const safeProfile = data as Record<string, string>;
                if (!safeProfile.username) return;

                allProfiles.push({
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

        // 3. Sort by Total Analyses Descending
        allProfiles.sort((a, b) => b.totalAnalyses - a.totalAnalyses);

        // 4. Apply Pagination
        const limit = options?.limit !== undefined ? options.limit : 30;
        if (limit === -1) {
            return {
                profiles: allProfiles,
                hasMore: false
            };
        }

        const page = Math.max(1, options?.page || 1);
        const validLimit = Math.max(1, limit);
        const startIndex = (page - 1) * validLimit;
        const endIndex = startIndex + validLimit;

        const paginatedProfiles = allProfiles.slice(startIndex, endIndex);
        const hasMore = endIndex < allProfiles.length;

        return {
            profiles: paginatedProfiles,
            hasMore
        };

    } catch (error) {
        console.error('[AnalysisStore] Failed to get paginated user profiles:', error);
        return { profiles: [], hasMore: false };
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

// End of file
