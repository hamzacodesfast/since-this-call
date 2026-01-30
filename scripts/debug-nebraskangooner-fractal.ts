
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Prod Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function debugNebraskangooner() {
    const { analyzeTweet } = await import('../src/lib/analyzer');

    // https://x.com/Nebraskangooner/status/2017060767971893360
    const tweetId = '2017060767971893360';

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

debugNebraskangooner();
