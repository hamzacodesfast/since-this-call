
import * as dotenv from 'dotenv';
import * as path from 'path';
// Load Prod Env to match production behavior
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getRedisClient } from '../src/lib/redis-client';
import type { StoredAnalysis } from '../src/lib/analysis-store';

async function removeTweet() {
    const tweetId = process.argv[2];
    const username = process.argv[3]; // Optional, heuristic checks otherwise

    if (!tweetId) {
        console.error('❌ Usage: npx tsx scripts/remove-tweet.ts <TWEET_ID> [USERNAME]');
        process.exit(1);
    }

    // Dynamic import to use loaded env
    const { recalculateUserProfile, untrackTicker, removeTickerStats } = await import('../src/lib/analysis-store');

    console.log(`🗑️ Removing Tweet ${tweetId}...`);

    const redis = getRedisClient();
    const RECENT_KEY = 'recent_analyses';

    // 1. Remove from Global Recent List
    const analysesData = await redis.lrange(RECENT_KEY, 0, -1);
    const analyses: StoredAnalysis[] = analysesData.map((item: any) =>
        typeof item === 'string' ? JSON.parse(item) : item
    );

    const newRecent = analyses.filter(a => a.id !== tweetId);

    if (newRecent.length !== analyses.length) {
        console.log(`Found in Global List - Removing`);
        await redis.del(RECENT_KEY);
        // Push back in reverse order (lpush) or just rpush if empty?
        // standard addAnalysis uses unshift (lpush equivalent logic on array then overwrite).
        // Let's preserve order.
        const serialized = newRecent.map(a => JSON.stringify(a));
        if (serialized.length > 0) {
            await redis.rpush(RECENT_KEY, ...serialized);
        }
    } else {
        console.log('Not found in global recent list.');
    }

    // 2. Remove from User History
    // If username not provided, try to find it from the tweet in recent list (if it was there)
    // or we might have to search all users (expensive but safer).

    let targetUser = username;

    if (!targetUser) {
        // Try to find in the deleted item from global
        const deletedGlobal = analyses.find(a => a.id === tweetId);
        if (deletedGlobal) {
            targetUser = deletedGlobal.username;
        } else {
            // Search all users
            console.log('Username not provided and not in recent list. Searching all users...');
            const allUsers = await redis.smembers('all_users');
            for (const u of allUsers) {
                const h = await redis.lrange(`user:history:${u}`, 0, -1);
                const found = h.some((item: any) => {
                    const p = typeof item === 'string' ? JSON.parse(item) : item;
                    return p.id === tweetId;
                });
                if (found) {
                    targetUser = u;
                    break;
                }
            }
        }
    }

    if (!targetUser) {
        console.log('❌ Could not find user for this tweet. It might already be gone.');
        process.exit(1);
    }

    console.log(`Target User: ${targetUser}`);
    const historyKey = `user:history:${targetUser}`;
    const historyData = await redis.lrange(historyKey, 0, -1);
    const history: StoredAnalysis[] = historyData.map((item: any) =>
        typeof item === 'string' ? JSON.parse(item) : item
    );

    const targetAnalysis = history.find(a => a.id === tweetId);
    const newHistory = history.filter(a => a.id !== tweetId);

    if (newHistory.length !== history.length) {
        console.log(`Found in User History (${targetUser}) - Removing`);

        await redis.del(historyKey);
        if (newHistory.length > 0) {
            const serialized = newHistory.map(a => JSON.stringify(a));
            await redis.rpush(historyKey, ...serialized);
        }

        // 3. Update User Profile
        await recalculateUserProfile(targetUser);
        console.log(`Recalculated stats for ${targetUser}`);

        // 4. Update Ticker Stats
        if (targetAnalysis) {
            console.log(`Updating Ticker Stats for ${targetAnalysis.symbol}...`);
            // Remove from Ticker Index
            await untrackTicker(targetAnalysis);
            // Decrement Ticker Profile Stats
            await removeTickerStats(targetAnalysis);
            console.log('Done.');
        }

    } else {
        console.log(`Not found in user history for ${targetUser}.`);
    }

    process.exit(0);
}

removeTweet();
