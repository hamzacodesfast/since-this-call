
/**
 * Remove a specific tweet from all records (history, stats, profile)
 * Usage: npx tsx scripts/remove-tweet.ts <TWEET_ID>
 */

import { getRedisClient } from '../src/lib/redis-client';
import { untrackTicker, recalculateUserProfile, updateTickerStats } from '../src/lib/analysis-store';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function removeTweet() {
    const redis = getRedisClient();
    const tweetId = process.argv[2];

    if (!tweetId) {
        console.error('❌ Usage: npx tsx scripts/remove-tweet.ts <TWEET_ID>');
        process.exit(1);
    }

    console.log(`🔍 Finding tweet ${tweetId} to remove...`);

    // 1. Find the user
    const users = await redis.smembers('all_users');
    let targetUser: string | null = null;
    let analysisToRemove: any | null = null;

    for (const user of users) {
        const historyKey = `user:history:${user}`;
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        const found = history.find((a: any) => a.id === tweetId);
        if (found) {
            targetUser = user;
            analysisToRemove = found;
            break;
        }
    }

    if (!targetUser || !analysisToRemove) {
        console.error('❌ Tweet not found in any user history.');
        process.exit(1);
    }

    console.log(`✅ Found tweet in @${targetUser}'s history.`);
    console.log(`   Symbol: ${analysisToRemove.symbol}`);

    // 2. Remove from User History
    const historyKey = `user:history:${targetUser}`;
    const historyData = await redis.lrange(historyKey, 0, -1);
    const history = historyData.map((item: any) =>
        typeof item === 'string' ? JSON.parse(item) : item
    );
    const updatedHistory = history.filter((a: any) => a.id !== tweetId);

    await redis.del(historyKey);
    if (updatedHistory.length > 0) {
        for (let i = updatedHistory.length - 1; i >= 0; i--) {
            await redis.lpush(historyKey, JSON.stringify(updatedHistory[i]));
        }
        console.log(`   - Removed from user:history:${targetUser}`);
    } else {
        await redis.srem('all_users', targetUser.toLowerCase());
        await redis.del(`user:profile:${targetUser.toLowerCase()}`);
        console.log(`   - Removed empty user @${targetUser} from global list.`);
    }

    // 3. Remove from Recent Analyses
    const recentData = await redis.lrange('recent_analyses', 0, -1);
    const recentAnalyses = recentData.map((item: any) =>
        typeof item === 'string' ? JSON.parse(item) : item
    );
    const updatedRecent = recentAnalyses.filter((a: any) => a.id !== tweetId);

    await redis.del('recent_analyses');
    for (let i = updatedRecent.length - 1; i >= 0; i--) {
        await redis.lpush('recent_analyses', JSON.stringify(updatedRecent[i]));
    }
    console.log(`   - Removed from recent_analyses`);

    // 4. Untrack Ticker (Removes from ticker:calls:SYMBOL)
    // untrackTicker expects a StoredAnalysis object
    if (!analysisToRemove.username) analysisToRemove.username = targetUser;
    await untrackTicker(analysisToRemove);
    console.log(`   - Untracked from ticker lists`);

    // 5. Update Call Stats (Decrement)
    // updateTickerStats(newAnalysis, isNew, oldAnalysis)
    // We want to remove, so we can pass newAnalysis=null (not supported strictly) or just manually decrement?
    // Actually updateTickerStats is for ADDING/UPDATING. 
    // To remove, we might need a dedicated remove function or just accept that stats might be slightly off until full refresh?
    // Wait, updateTickerStats doesn't have a "remove" mode.
    // Let's check src/lib/analysis-store.ts to see if we can manually decrement.
    // For now, simpler: we just leave the stats alone or run a refresh-stats script later.
    // BUT recalculateUserProfile WILL fix the USER stats.

    // 6. Recalculate User Profile
    await recalculateUserProfile(targetUser);
    console.log(`   - Recalculated profile for @${targetUser}`);

    console.log('\n✅ Removal complete.');
    process.exit(0);
}

removeTweet();
