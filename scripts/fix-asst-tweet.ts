
import * as dotenv from 'dotenv';
import * as path from 'path';

// Fix Prod Data
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function fixAsstTweet() {
    console.log('🏗️ Repairing ASST Tweet...');

    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { updateUserProfile, addAnalysis } = await import('../src/lib/analysis-store');

    // https://x.com/TheSkayeth/status/2015662860425408527
    const tweetId = '2015662860425408527';
    const username = 'TheSkayeth';

    try {
        console.log(`Re-analyzing ${tweetId}...`);
        // Force type STOCK to ensure our whitelisting logic holds
        const result = await analyzeTweet(tweetId, undefined, 'STOCK');

        console.log(`Analysis: ${result.analysis.symbol} (${result.analysis.type})`);
        console.log(`Prices: Call $${result.market.callPrice} / Current $${result.market.currentPrice}`);

        const analysis = {
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

        console.log('Updating Global Feed...');
        await addAnalysis(analysis as any);

        console.log('Updating Profile...');
        await updateUserProfile(analysis as any);

        console.log(`✅ Fixed ASST entry for @${username}.`);

    } catch (e) {
        console.error('❌ Repair failed:', e);
    }

    process.exit(0);
}

fixAsstTweet();
