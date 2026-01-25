
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Prod Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function debugDate() {
    const { analyzeTweet } = await import('../src/lib/analyzer');

    // The problematic AAPL tweet
    const tweetId = '2014091925092180287';

    try {
        console.log(`Fetching tweet ${tweetId}...`);
        const result = await analyzeTweet(tweetId);

        console.log('Tweet Date Raw:', result.tweet.date);
        console.log('Tweet Date Parsed:', new Date(result.tweet.date));
        console.log('Tweet Timestamp:', new Date(result.tweet.date).getTime());

        if (isNaN(new Date(result.tweet.date).getTime())) {
            console.error('❌ Date parsing FAILED');
        } else {
            console.log('✅ Date parsing OK');
        }

    } catch (e) {
        console.error('Error:', e);
    }

    process.exit(0);
}

debugDate();
