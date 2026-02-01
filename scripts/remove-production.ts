import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import path from 'path';

// Load envs
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

// Constants from analysis-store.ts
const RECENT_KEY = 'recent_analyses';
const USER_HISTORY_PREFIX = 'user:history:';
const USER_PROFILE_PREFIX = 'user:profile:';
const TICKER_INDEX_PREFIX = 'ticker_index:';
const TICKER_PROFILE_PREFIX = 'ticker:profile:';
const TRACKED_TICKERS_KEY = 'tracked_tickers';
const GLOBAL_ANALYSES_ZSET = 'global:analyses:timestamp';

// Helper to get ticker key
function getTickerKey(analysis: any): string {
    const symbol = analysis.symbol.toUpperCase();
    const type = analysis.type || 'CRYPTO';
    return `${type}:${symbol}`;
}

async function main() {
    const tweetId = process.argv[2];
    const usernameArg = process.argv[3];

    if (!tweetId) {
        console.error("Usage: npx tsx scripts/remove-production.ts <TWEET_ID> [USERNAME]");
        process.exit(1);
    }

    if (!process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL || !process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN) {
        console.error("Missing PROD_UPSTASH_REDIS credentials in environment.");
        process.exit(1);
    }

    const redis = new Redis({
        url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL,
        token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
    });

    console.log(`🚨 DELETING Tweet ID: ${tweetId} from PRODUCTION 🚨`);

    let targetAnalysis: any = null;
    let username = usernameArg;

    // 1. Find the analysis
    if (username) {
        console.log(`Fetching history for ${username}...`);
        const history = await redis.lrange(`${USER_HISTORY_PREFIX}${username.toLowerCase()}`, 0, -1);
        const historyItems = history.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
        targetAnalysis = historyItems.find((item: any) => item.id === tweetId);
    } else {
        // Search global recent first (faster)
        console.log(`Searching recent analyses...`);
        const recent = await redis.lrange(RECENT_KEY, 0, -1);
        const recentItems = recent.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
        targetAnalysis = recentItems.find((item: any) => item.id === tweetId);

        if (!targetAnalysis) {
            console.error("Could not find analysis in Recent. Please provide USERNAME argument to search specific user history.");
            process.exit(1);
        }
        username = targetAnalysis.username;
    }

    if (!targetAnalysis) {
        console.error(`Analysis ${tweetId} not found for user ${username}.`);
        process.exit(1);
    }

    console.log(`Found Analysis: ${targetAnalysis.symbol} (${targetAnalysis.sentiment}) by ${username}`);
    const tickerKey = getTickerKey(targetAnalysis);
    const analysisRef = `${username!.toLowerCase()}:${tweetId}`;

    // 2. Remove from User History
    console.log(`Removing from User History...`);
    const historyKey = `${USER_HISTORY_PREFIX}${username!.toLowerCase()}`;
    const historyData = await redis.lrange(historyKey, 0, -1);
    let history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
    const initialLen = history.length;
    history = history.filter((item: any) => item.id !== tweetId);

    if (history.length < initialLen) {
        await redis.del(historyKey);
        const p = redis.pipeline();
        for (let i = history.length - 1; i >= 0; i--) {
            p.lpush(historyKey, JSON.stringify(history[i]));
        }
        await p.exec();
        console.log(`✅ Removed from User History`);
    }

    // 3. Update User Profile (Recalculate)
    console.log(`Recalculating User Profile...`);
    let wins = 0, losses = 0, neutral = 0;
    for (const item of history) {
        if (Math.abs(item.performance) < 0.01) neutral++;
        else if (item.isWin) wins++;
        else losses++;
    }
    const total = history.length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;

    const profileKey = `${USER_PROFILE_PREFIX}${username!.toLowerCase()}`;
    await redis.hset(profileKey, {
        totalAnalyses: total,
        wins,
        losses,
        neutral,
        winRate,
        lastAnalyzed: Date.now() // Optional: keep old or update? Update seems safer to force refresh
    });
    console.log(`✅ Updated User Profile`);

    // 4. Remove from Global Recent
    console.log(`Removing from Recent Analyses...`);
    const recentData = await redis.lrange(RECENT_KEY, 0, -1);
    let recent = recentData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
    const recentLen = recent.length;
    recent = recent.filter((item: any) => item.id !== tweetId);

    if (recent.length < recentLen) {
        await redis.del(RECENT_KEY);
        const p = redis.pipeline();
        for (const item of recent) {
            p.rpush(RECENT_KEY, JSON.stringify(item));
        }
        await p.exec();
        console.log(`✅ Removed from Recent Analyses`);
    }

    // 5. Remove from Index (Timeline) and Ticker Index
    console.log(`Removing from Indexes...`);
    const indexKey = `${TICKER_INDEX_PREFIX}${tickerKey}`;

    await redis.zrem(GLOBAL_ANALYSES_ZSET, analysisRef);
    await redis.zrem(indexKey, analysisRef);
    console.log(`✅ Removed from Ticker Index & Global Timeline`);

    // 6. Update Ticker Stats (Decrement)
    console.log(`Updating Ticker Profile for ${tickerKey}...`);
    const tickerProfileKey = `${TICKER_PROFILE_PREFIX}${tickerKey}`;
    const existingTicker = await redis.hgetall(tickerProfileKey) as any;

    if (existingTicker) {
        const stats = {
            totalAnalyses: parseInt(existingTicker.totalAnalyses || '0'),
            wins: parseInt(existingTicker.wins || '0'),
            losses: parseInt(existingTicker.losses || '0'),
            neutral: parseInt(existingTicker.neutral || '0'),
            bullish: parseInt(existingTicker.bullish || '0'),
            bearish: parseInt(existingTicker.bearish || '0'),
            winRate: parseFloat(existingTicker.winRate || '0')
        };

        if (Math.abs(targetAnalysis.performance) < 0.01) stats.neutral--;
        else if (targetAnalysis.isWin) stats.wins--;
        else stats.losses--;

        if (targetAnalysis.sentiment === 'BULLISH') stats.bullish--;
        else if (targetAnalysis.sentiment === 'BEARISH') stats.bearish--;

        stats.totalAnalyses--;
        stats.winRate = stats.totalAnalyses > 0 ? (stats.wins / stats.totalAnalyses) * 100 : 0;

        if (stats.totalAnalyses <= 0) {
            await redis.del(tickerProfileKey);
            // Also remove from tracked_tickers?
            // Checking if index is empty
            const remaining = await redis.zcard(indexKey);
            if (remaining === 0) {
                await redis.srem(TRACKED_TICKERS_KEY, tickerKey);
                console.log(`✅ Ticker ${tickerKey} no longer tracked (empty)`);
            }
        } else {
            // We only update the stats fields we changed
            await redis.hset(tickerProfileKey, {
                totalAnalyses: stats.totalAnalyses,
                wins: stats.wins,
                losses: stats.losses,
                neutral: stats.neutral,
                bullish: stats.bullish,
                bearish: stats.bearish,
                winRate: stats.winRate
            });
        }
        console.log(`✅ Updated Ticker Stats`);
    } else {
        console.log(`⚠️ Ticker Profile not found (might be already deleted)`);
    }

    console.log(`\n🎉 Successfully removed Tweet ${tweetId}!`);
}

main().catch(console.error);
