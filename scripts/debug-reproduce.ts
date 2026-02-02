
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Redis } from '@upstash/redis';

// Load Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const { analyzeTweet } = await import('../src/lib/analyzer');
    // Using Aster_DEX tweet ID from previous logs
    const tweetId = '2015726457943965947';

    console.log(`🕵️ Debugging Tweet ${tweetId}...`);

    try {
        const result = await analyzeTweet(tweetId);
        console.log('✅ Analysis PASSED:');
        console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
        console.log('❌ Analysis FAILED (Expected if strict):');
        console.log(e.message);
    }
}

main().catch(console.error);
