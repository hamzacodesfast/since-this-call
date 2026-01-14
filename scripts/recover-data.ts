
import * as dotenv from 'dotenv';
import path from 'path';
import { Redis } from '@upstash/redis';

// Load Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const RECENT_ANALYSES_KEY = 'recent_analyses';

// Retrieved from logs of failed run
const RECOVERED_IDS = [
    '1987873099203957073', // GLD
    '2009728017690702076', // SPX6900
    '2005623836746953045', // SLV
    '2011131177466290284',
    '2010726002478252276', // SLV
    '2000885910951653380', // SAITO
    '2011121102701855135',
    '2008740377629806725', // BTC
    '2011201444079407510',
    '2001297952233468256', // AAPL
    '2002112942054215875', // PLTR
    '1605321511115661312', // FDX
    '1991919787090563512',
    '2005485913019998301', // ZEC
    '2009390159347978365', // BTC
    '2011185904967389524', // MSTR
    '1944638949944607020', // BTC
];

async function main() {
    console.log(`🚑 Starting Recovery for ${RECOVERED_IDS.length} IDs...`);

    // Dynamic import to avoid env hoisting issues
    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { StoredAnalysisSchema } = await import('../src/lib/analysis-store');

    // Clear list to be safe (we are rebuilding)
    await redis.del(RECENT_ANALYSES_KEY);
    console.log('Cleared recent_analyses.');

    let successCount = 0;

    for (let i = 0; i < RECOVERED_IDS.length; i++) {
        const id = RECOVERED_IDS[i];
        console.log(`\nProcessing ${i + 1}/${RECOVERED_IDS.length}: ${id}...`);

        try {
            const result = await analyzeTweet(id);

            if (!result || !result.tweet) {
                console.error(`❌ Analysis failed/null for ${id}`);
                continue;
            }

            const { analysis, market, tweet } = result;

            // FIX: Use top-level username field
            if (!tweet.username) {
                console.error(`❌ Tweet username missing for ${id}. Dump:`, JSON.stringify(tweet).substring(0, 200));
                continue;
            }

            const storedAnalysis = {
                id: tweet.id, // Normalized id usually at top level too?
                username: tweet.username,
                author: tweet.author,
                avatar: tweet.avatar || '',
                symbol: analysis.symbol,
                sentiment: analysis.sentiment,
                performance: market.performance,
                isWin: market.performance > 0,
                timestamp: new Date(tweet.date).getTime(),
                entryPrice: market.callPrice,
                currentPrice: market.currentPrice,
                type: analysis.type,
            };

            // Note: tweet.id vs tweet.id_str. Analyzer returns `id`.

            const parsed = StoredAnalysisSchema.safeParse(storedAnalysis);
            if (!parsed.success) {
                console.error(`❌ Validation failed for ${id}:`, parsed.error);
                continue;
            }

            await redis.lpush(RECENT_ANALYSES_KEY, JSON.stringify(parsed.data));
            console.log(`✅ Recovered: ${analysis.symbol}`);
            successCount++;

            // Rate Limit Delay
            console.log('⏳ Cooling down (6s)...');
            await new Promise(r => setTimeout(r, 6000));

        } catch (e: any) {
            console.error(`❌ Error processing ${id}:`, e.message);
        }
    }

    console.log(`\n🏁 Recovery Complete. Success: ${successCount}/${RECOVERED_IDS.length}`);
    process.exit(0);
}

main();
