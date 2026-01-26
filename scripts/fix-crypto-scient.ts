
import * as dotenv from 'dotenv';
import * as path from 'path';

// Fix Prod Data
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function fixCryptoScient() {
    console.log('🧪 Repairing Crypto_Scient Tweet...');

    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { updateUserProfile, addAnalysis } = await import('../src/lib/analysis-store');

    // https://x.com/Crypto_Scient/status/2015132440239718628
    const tweetId = '2015132440239718628';

    try {
        console.log(`Re-analyzing ${tweetId}...`);
        const result = await analyzeTweet(tweetId);

        console.log(`Symbol: ${result.analysis.symbol}`);
        console.log(`Sentiment: ${result.analysis.sentiment}`);
        console.log(`Reasoning: ${result.analysis.reasoning}`);

        const analysis = {
            id: result.tweet.id,
            username: result.tweet.username,
            author: result.tweet.author,
            avatar: result.tweet.avatar,
            symbol: result.analysis.symbol,
            sentiment: result.analysis.sentiment, // Should be BULLISH now
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

        console.log(`✅ Fixed Crypto_Scient entry (Now ${result.analysis.sentiment}).`);

    } catch (e) {
        console.error('❌ Repair failed:', e);
    }

    process.exit(0);
}

fixCryptoScient();
