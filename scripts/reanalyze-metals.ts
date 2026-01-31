
import * as dotenv from 'dotenv';
import * as path from 'path';

// Force Production Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function reanalyzeMetals() {
    console.log('🏗️  Starting Metals Re-analysis (XAU, XAG)...');

    const { getRedisClient } = await import('../src/lib/redis-client');
    const redis = getRedisClient();
    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { addAnalysis, updateUserProfile } = await import('../src/lib/analysis-store');

    // 1. Find all tweets for metals
    const allKeys = await redis.keys('analysis:*');
    console.log(`Found ${allKeys.length} total analyses to check.`);

    const targets = new Set(['XAU', 'XAUUSD', 'GOLD', 'XAG', 'XAGUSD', 'SILVER', 'GLD', 'SLV']);
    const toReanalyze: string[] = [];

    for (const key of allKeys) {
        const data = await redis.hgetall(key);
        if (data && data.symbol && targets.has((data.symbol as string).toUpperCase())) {
            toReanalyze.push(data.id as string);
        }
    }

    // Also check recent_analyses list
    const recentData = await redis.lrange('recent_analyses', 0, -1);
    for (const item of recentData) {
        const data = typeof item === 'string' ? JSON.parse(item) : item;
        if (data && data.symbol && targets.has(data.symbol.toUpperCase())) {
            if (!toReanalyze.includes(data.id)) {
                toReanalyze.push(data.id);
            }
        }
    }

    console.log(`Found ${toReanalyze.length} unique metal-related tweets to re-analyze.`);

    for (const tweetId of toReanalyze) {
        try {
            console.log(`\nProcessing Tweet: ${tweetId}...`);
            // We use analyzeTweet which will now use the updated fallbacks in market-data.ts
            const result = await analyzeTweet(tweetId);

            console.log(`✅ Result: ${result.analysis.symbol} | New Price: ${result.market.callPrice} | Current: ${result.market.currentPrice}`);

            const updatedAnalysis = {
                id: result.tweet.id,
                username: result.tweet.username,
                author: result.tweet.author,
                avatar: result.tweet.avatar,
                symbol: result.analysis.symbol,
                sentiment: result.analysis.sentiment,
                performance: result.market.performance,
                isWin: result.market.performance > 0,
                entryPrice: result.market.callPrice,
                currentPrice: result.market.currentPrice,
                type: result.analysis.type,
                contractAddress: result.analysis.contractAddress,
                timestamp: new Date(result.tweet.date).getTime(),
                reasoning: result.analysis.reasoning
            };

            await addAnalysis(updatedAnalysis as any);
            await updateUserProfile(updatedAnalysis as any);
            console.log(`Successfully updated ${tweetId}`);
        } catch (e) {
            console.error(`Failed to re-analyze ${tweetId}:`, e);
        }
    }

    console.log('\n✨ Metals re-analysis complete.');
    process.exit(0);
}

reanalyzeMetals();
