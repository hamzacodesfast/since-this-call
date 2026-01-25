
import * as dotenv from 'dotenv';
import * as path from 'path';

// Fix Prod Data
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function fixBased16z() {
    console.log('📉 Repairing based16z Data...');

    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { updateUserProfile } = await import('../src/lib/analysis-store');
    const { getRedisClient } = await import('../src/lib/redis-client');

    const tweetId = '2015189459420041606';
    const username = 'based16z';
    const redis = getRedisClient();

    try {
        // 1. Re-analyze with new logic (Target price logic)
        console.log(`Re-analyzing ${tweetId}...`);
        const result = await analyzeTweet(tweetId);
        console.log(`New Sentiment: ${result.analysis.sentiment} (Reason: ${result.analysis.reasoning})`);

        // 2. Remove old entry from user history
        const historyKey = `user:history:${username}`;
        const history = await redis.lrange(historyKey, 0, -1);

        const cleanedHistory = [];
        for (const item of history) {
            const p = typeof item === 'string' ? JSON.parse(item) : item;
            if (p.id !== tweetId) {
                cleanedHistory.push(item);
            }
        }

        await redis.del(historyKey);
        if (cleanedHistory.length > 0) {
            await redis.rpush(historyKey, ...cleanedHistory);
        }

        // 3. Save new analysis
        const analysis = {
            id: result.tweet.id,
            username: result.tweet.username,
            author: result.tweet.author,
            avatar: result.tweet.avatar,
            symbol: result.analysis.symbol,
            sentiment: result.analysis.sentiment,
            performance: result.market.performance,
            isWin: result.market.performance < 0, // Bearish win if performance is negative
            entryPrice: result.market.callPrice,
            currentPrice: result.market.currentPrice,
            type: result.analysis.type,
            contractAddress: result.analysis.contractAddress,
            timestamp: new Date(result.tweet.date).getTime(),
            reasoning: result.analysis.reasoning
        };

        await updateUserProfile(analysis as any);
        console.log(`✅ Fixed entry and synced profile for @${username}.`);

    } catch (e) {
        console.error('❌ Repair failed:', e);
    }

    process.exit(0);
}

fixBased16z();
