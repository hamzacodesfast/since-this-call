
/**
 * Re-analyze a specific tweet to correct data (e.g. price, symbol, sentiment)
 * Usage: npx tsx scripts/reanalyze.ts <TWEET_ID> [CA_OVERRIDE]
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

async function reanalyze() {
    // Dynamic imports to ensure env vars are loaded first
    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { recalculateUserProfile, trackTicker, untrackTicker, updateTickerStats } = await import('../src/lib/analysis-store');
    const { getRedisClient } = await import('../src/lib/redis-client');

    const redis = getRedisClient();

    const tweetId = process.argv[2];
    const symbolOverride = process.argv.find(a => a.startsWith('--symbol='))?.split('=')[1];
    const actionOverride = process.argv.find(a => a.startsWith('--action='))?.split('=')[1] as 'BUY' | 'SELL' | undefined;
    const caOverride = process.argv[3]?.startsWith('--') ? undefined : process.argv[3];

    if (!tweetId) {
        console.error('❌ Usage: npx tsx scripts/reanalyze.ts <TWEET_ID> [CA_OVERRIDE] [--symbol=SYMBOL] [--action=BUY/SELL]');
        process.exit(1);
    }

    console.log(`🔍 Searching for tweet ${tweetId}...`);

    // 1. Find the user who owns this analysis
    const users = await redis.smembers('all_users');
    let targetUser: string | null = null;
    let oldAnalysis: StoredAnalysis | null = null;

    for (const user of users) {
        const historyKey = `user:history:${user}`;
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history: StoredAnalysis[] = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        const found = history.find(a => a.id === tweetId);
        if (found) {
            targetUser = user;
            oldAnalysis = found;
            break;
        }
    }

    if (!targetUser || !oldAnalysis) {
        console.error('❌ Tweet analysis not found in any user history.');
        process.exit(1);
    }

    console.log(`✅ Found tweet in @${targetUser}'s history.`);
    console.log(`   Text: "${oldAnalysis.text || 'N/A'}"`);
    console.log(`   Old Symbol: ${oldAnalysis.symbol}`);
    console.log(`   Old Entry Price: $${oldAnalysis.entryPrice}`);
    console.log(`   Old Performance: ${oldAnalysis.performance.toFixed(2)}%`);

    // 2. Re-analyze the tweet
    console.log('\n🔄 Re-analyzing tweet...');
    try {
        const sentimentOverride = actionOverride === 'BUY' ? 'BULLISH' :
            actionOverride === 'SELL' ? 'BEARISH' : undefined;

        const newResult = await analyzeTweet(tweetId, caOverride as any, symbolOverride, sentimentOverride);

        console.log(`\n🤖 AI Extraction:`);
        console.log(`   Action: ${newResult.analysis.action}`);
        console.log(`   Ticker: ${newResult.analysis.ticker}`);
        console.log(`   Reasoning: ${newResult.analysis.reasoning}`);

        // Construct new stored analysis
        const newAnalysis: StoredAnalysis = {
            id: oldAnalysis.id,

            // Metadata
            tweetUrl: oldAnalysis.tweetUrl || `https://x.com/${oldAnalysis.username || targetUser}/status/${oldAnalysis.id}`,
            text: newResult.tweet.text, // ALWAYS use fresh text (might fix link-only tweets)
            author: oldAnalysis.author,
            username: oldAnalysis.username || targetUser, // Fallback to targetUser if missing
            avatar: oldAnalysis.avatar,
            timestamp: oldAnalysis.timestamp,

            // Updated fields
            symbol: newResult.analysis.symbol,
            type: newResult.analysis.type,
            sentiment: newResult.analysis.sentiment,

            entryPrice: newResult.market.callPrice,
            currentPrice: newResult.market.currentPrice,
            performance: newResult.market.performance,
            isWin: newResult.market.performance > 0
        };

        console.log(`\n📊 New Analysis Data:`);
        console.log(`   Symbol: ${newAnalysis.symbol}`);
        console.log(`   Entry Price: $${newAnalysis.entryPrice}`);
        console.log(`   Current Price: $${newAnalysis.currentPrice}`);
        console.log(`   Performance: ${newAnalysis.performance.toFixed(2)}% (${newAnalysis.isWin ? 'WIN' : 'LOSS'})`);

        // 3. Update User History
        console.log(`\n💾 Updating Redis records...`);
        const historyKey = `user:history:${targetUser}`;

        // Fetch fresh history again 
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history: StoredAnalysis[] = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        // Replace old analysis
        const updatedHistory = history.map(item => item.id === tweetId ? newAnalysis : item);

        // Write back
        await redis.del(historyKey);
        for (let i = updatedHistory.length - 1; i >= 0; i--) {
            await redis.lpush(historyKey, JSON.stringify(updatedHistory[i]));
        }
        console.log(`   - Updated user:history:${targetUser}`);

        // 4. Update Recent Analyses (if present)
        const recentData = await redis.lrange('recent_analyses', 0, -1);
        let recentAnalyses: StoredAnalysis[] = recentData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        const recentIndex = recentAnalyses.findIndex(a => a.id === tweetId);
        if (recentIndex !== -1) {
            recentAnalyses[recentIndex] = newAnalysis;
            await redis.del('recent_analyses');
            for (let i = recentAnalyses.length - 1; i >= 0; i--) {
                await redis.lpush('recent_analyses', JSON.stringify(recentAnalyses[i]));
            }
            console.log(`   - Updated recent_analyses`);
        }

        // 5. Recalculate User Profile
        await recalculateUserProfile(targetUser);
        console.log(`   - Recalculated profile for @${targetUser}`);

        // 6. Update Ticker Tracking
        // First untrack old one (in case symbol changed)
        // Ensure username is present for untracking old legacy records
        if (!oldAnalysis.username) {
            oldAnalysis.username = targetUser;
        }
        await untrackTicker(oldAnalysis);
        // Then track new one
        await trackTicker(newAnalysis);
        console.log(`   - Updated ticker tracking (removed old: ${oldAnalysis.symbol}, added new: ${newAnalysis.symbol})`);

        // 7. Update Ticker Stats
        // Remove old stats logic is tricky, but updateTickerStats handles "existing replaced by new" if we pass oldAnalysis
        // But here we are NOT replacing in place in the stats function, we are conceptually "editing".
        // updateTickerStats takes (analysis, isNew, oldAnalysis).
        // If isNew=false and oldAnalysis provided, it decrements old and increments new.
        await updateTickerStats(newAnalysis, false, oldAnalysis);
        console.log(`   - Updated ticker stats (decremented old, incremented new)`);

        console.log('\n✅ Re-analysis complete! Changes are live.');
        process.exit(0);

    } catch (e: any) {
        if (e.message && e.message.includes('Could not identify financial call')) {
            console.warn('\n⚠️ AI rejected this tweet (Not a financial call).');
            console.warn('❌ Auto-removal is DISABLED to prevent data loss. Please remove manually if needed.');
            process.exit(1);
        }

        console.error('❌ Re-analysis failed:', e.message);
        console.error(e);
        process.exit(1);
    }
}

reanalyze();
