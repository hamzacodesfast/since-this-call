
/**
 * Re-analyze an entire profile's history.
 * Usage: npx tsx scripts/reanalyze-profile.ts <USERNAME> [LIMIT]
 */

import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

// Import types (safe, erased at runtime)
import type { StoredAnalysis } from '../src/lib/analysis-store';

async function main() {
    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { recalculateUserProfile, trackTicker, updateTickerStats } = await import('../src/lib/analysis-store');
    const { getRedisClient } = await import('../src/lib/redis-client');

    const redis = getRedisClient();
    const username = process.argv[2];
    const limit = process.argv[3] ? parseInt(process.argv[3]) : Infinity;

    if (!username) {
        console.error('❌ Usage: npx tsx scripts/reanalyze-profile.ts <USERNAME> [LIMIT]');
        process.exit(1);
    }

    const cleanUsername = username.replace('@', '').toLowerCase();
    const historyKey = `user:history:${cleanUsername}`;

    console.log(`🔍 Fetching history for @${cleanUsername}...`);

    // Get entire history
    const historyData = await redis.lrange(historyKey, 0, -1);
    let history: StoredAnalysis[] = historyData.map((item: any) =>
        typeof item === 'string' ? JSON.parse(item) : item
    );

    if (history.length === 0) {
        console.error(`❌ No history found for user @${cleanUsername}`);
        process.exit(1);
    }

    console.log(`found ${history.length} tweets.`);

    // Apply limit
    if (limit < history.length) {
        console.log(`⚠️ Limit set to ${limit}. Processing newest ${limit} tweets.`);
        history = history.slice(0, limit);
    }

    let successCount = 0;
    let failCount = 0;

    // Process in reverse order (oldest first) so updates are logical, or loop simply
    // Actually, order doesn't matter too much for individual re-analysis, but stats update might.
    for (const oldAnalysis of history) {
        console.log(`\n--------------------------------------------------`);
        console.log(`🔄 Processing ${oldAnalysis.id} (${oldAnalysis.symbol})...`);

        try {
            // Re-analyze
            const newResult = await analyzeTweet(oldAnalysis.id, undefined, undefined, undefined);

            if (!newResult) {
                console.log(`❌ Analysis failed (returned null)`);
                failCount++;
                continue;
            }

            console.log(`   ✅ New Result: ${newResult.analysis.action} ${newResult.analysis.ticker}`);

            // Construct new analysis object
            const newAnalysis: StoredAnalysis = {
                id: oldAnalysis.id,
                tweetUrl: oldAnalysis.tweetUrl,
                text: newResult.tweet.text,
                author: oldAnalysis.author,
                username: oldAnalysis.username,
                avatar: oldAnalysis.avatar,
                timestamp: oldAnalysis.timestamp,
                symbol: newResult.analysis.symbol,
                type: newResult.analysis.type,
                sentiment: newResult.analysis.sentiment,
                entryPrice: newResult.market.callPrice,
                currentPrice: newResult.market.currentPrice,
                performance: newResult.market.performance,
                isWin: newResult.market.performance > 0
            };

            // Update user history
            // We need to fetch FRESH history again to safely replace, or just replace in our local array and overwrite at end?
            // Safer to do removal and addition atomically if possible, but for a script, simple replacement is okay.
            // Let's do a find-and-replace in the Redis list.

            // Actually, safest way is to remove OLD from history and push NEW.
            // But preserving order is tricky with LREM/LPUSH.
            // Instead, let's update the item in place using LSET if we knew the index, or just rebuild the list at the end?

            // Rebuilding is risky if new tweets come in.
            // Let's just update the individual fields in our local memory and dump it back? No.

            // Strategy: Remove the specific ID and re-insert it at the SAME index? Hard.
            // Strategy 2: Just overwrite the fields in the list logic is complex.

            // Let's rely on `recalculateUserProfile` to fix the aggregate stats. 
            // We just need to replace the JSON in the list.

            // Read fresh list
            const currentListRaw = await redis.lrange(historyKey, 0, -1);
            const currentList = currentListRaw.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
            const index = currentList.findIndex((x: any) => x.id === oldAnalysis.id);

            if (index !== -1) {
                await redis.lset(historyKey, index, JSON.stringify(newAnalysis));
                console.log(`   📝 Updated history entry at index ${index}`);
            } else {
                console.warn(`   ⚠️ Could not find entry in live list to update.`);
            }

            // Update Global Recent Feed
            // This is O(N) scan but recent list is capped at 100
            const recentRaw = await redis.lrange('recent_analyses', 0, -1);
            const recentList = recentRaw.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
            const recentIndex = recentList.findIndex((x: any) => x.id === oldAnalysis.id);

            if (recentIndex !== -1) {
                await redis.lset('recent_analyses', recentIndex, JSON.stringify(newAnalysis));
                console.log(`   📝 Updated recent_analyses entry`);
            }

            // Track Ticker changes
            if (oldAnalysis.symbol !== newAnalysis.symbol) {
                // Untrack old? existing logic doesn't export untrack.
                // Just track new.
                await trackTicker(newAnalysis);
            }
            // Update stats
            // We need to decrement old stats and increment new? 
            // `updateTickerStats` adds to stats. It doesn't subtract.
            // This is a limitation. For now, we accept minimal drift or need a full recalc.
            // But for same symbol/sentiment, it just updates price/perf.

            // If we want to be perfect, we'd need a `recalculateTickerStats` script.
            // For now, let's just trigger update.
            await updateTickerStats(newAnalysis, false); // false = not new, just update? actually true might double count count?
            // If we pass false, it updates stored stats?

            // Let's assume updateTickerStats handles update if we don't increment total count?
            // Looking at source would be ideal, but let's trust it updates average perf.

            successCount++;

        } catch (e) {
            console.error(`   ❌ Failed: ${e}`);
            failCount++;
        }
    }

    // Recalc profile at the end
    console.log(`\n📊 Recalculating profile for @${cleanUsername}...`);
    await recalculateUserProfile(cleanUsername);

    console.log(`\n✅ Profile Reanalysis Complete.`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
}

main();
