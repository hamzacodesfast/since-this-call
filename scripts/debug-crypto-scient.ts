
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Prod Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function debugCryptoScient() {
    const { analyzeTweet } = await import('../src/lib/analyzer');

    // https://x.com/Crypto_Scient/status/2015132440239718628
    const tweetId = '2015132440239718628';

    console.log(`Analyzing Tweet ${tweetId}...`);
    try {
        const result = await analyzeTweet(tweetId);
        console.log('--- Analysis Result ---');
        console.log(`Symbol: ${result.analysis.symbol}`);
        console.log(`Type: ${result.analysis.type}`);
        console.log(`Sentiment: ${result.analysis.sentiment}`);
        console.log(`Confidence: ${result.analysis.confidence_score}`);
        console.log(`Reasoning: ${result.analysis.reasoning}`);
        console.log('--- Tweet Content ---');
        console.log(`Text: ${result.tweet.text}`);

    } catch (e) {
        console.error('Analysis failed:', e);
    }

    process.exit(0);
}

debugCryptoScient();
