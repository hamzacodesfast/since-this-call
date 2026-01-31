
import * as dotenv from 'dotenv';
import * as path from 'path';

// Force Production Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function fixBrandtTweets() {
    const { getRedisClient } = await import('../src/lib/redis-client');
    const redis = getRedisClient();
    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { addAnalysis, updateUserProfile } = await import('../src/lib/analysis-store');

    const tweetIds = ['2017011842133217675', '2017017338160406573'];

    for (const tweetId of tweetIds) {
        console.log(`\n--- Processing Brandt Tweet: ${tweetId} ---`);
        try {
            // Re-analyze and force fix
            const result = await analyzeTweet(tweetId);

            console.log(`✅ Result: ${result.analysis.symbol} (${result.analysis.type})`);
            console.log(`Sentiment: ${result.analysis.sentiment}`);
            console.log(`New Entry Price (GLD): ${result.market.callPrice}`);
            console.log(`Current Price (GLD): ${result.market.currentPrice}`);

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
            console.log(`Successfully fixed and pushed ${tweetId}`);
        } catch (e) {
            console.error(`Failed to process ${tweetId}:`, e);
        }
    }

    process.exit(0);
}

fixBrandtTweets();
