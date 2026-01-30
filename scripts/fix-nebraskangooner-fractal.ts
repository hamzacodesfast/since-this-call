
import * as dotenv from 'dotenv';
import * as path from 'path';

// Fix Prod Data
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function fixNebraskangoonerTweet() {
    console.log('🏗️ Repairing Nebraskangooner Tweet...');

    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { updateUserProfile, addAnalysis } = await import('../src/lib/analysis-store');

    // https://x.com/Nebraskangooner/status/2017060767971893360
    const tweetId = '2017060767971893360';
    const username = 'Nebraskangooner';

    try {
        console.log(`Re-analyzing ${tweetId}...`);
        // Force type CRYPTO just in case, though AI should get it.
        const result = await analyzeTweet(tweetId, undefined, 'CRYPTO');

        console.log(`Analysis: ${result.analysis.symbol} (${result.analysis.type})`);
        console.log(`Sentiment: ${result.analysis.sentiment}`);
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

        console.log(`✅ Fixed entry for @${username}.`);

    } catch (e) {
        console.error('❌ Repair failed:', e);
    }

    process.exit(0);
}

fixNebraskangoonerTweet();
