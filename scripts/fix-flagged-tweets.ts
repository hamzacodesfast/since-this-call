
import { execSync } from 'child_process';
import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function fixFlaggedTweets() {
    console.log('🔧 Starting Automated Fix Process...');

    // Explicit list of IDs found in our scan
    // This is safer than re-scanning to avoid infinite loops if the fix doesn't clear the flag immediately
    const CANDIDATES = [
        '2018466189648031993', // rdd147 (TSLA, Management Criticism)
        '2016875011244531740', // JSpitTrades (MP, Low Conf)
        '2016950373182062761', // DonnyDicey (ZEC, Meme Coin Risk)
        '2017584079114490000', // SolanaFloor (SOL, Hack/News)
        '2017177134369026085', // dxrnell (ELON, High Volatility)
        '2017404027449774576', // AltcoinSherpa (BTC, Low Conf)
        '2017293333891027382', // NighthawkTradez (IREN, Low Conf)
        '2017552307513081871', // elGodric (PENGUIN, Low Cap)
        '2017570533584343120', // GenuineDegen (PACT, Low Conf)
        '2018690696190873711'  // victorious__5 (BTC, Live Show)
    ];

    console.log(`📋 Processing ${CANDIDATES.length} candidates...`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < CANDIDATES.length; i++) {
        const id = CANDIDATES[i];
        console.log(`\n------------------------------------------------`);
        console.log(`[${i + 1}/${CANDIDATES.length}] Fixing Tweet ID: ${id}`);

        try {
            // Call reanalyze.ts for this ID
            // We use inherit for stdio to see the reanalyze output in real-time
            execSync(`npx tsx scripts/reanalyze.ts ${id}`, { stdio: 'inherit' });

            console.log(`✅ Successfully re-analyzed ${id}`);
            successCount++;
        } catch (error) {
            console.error(`❌ Failed to re-analyze ${id}`);
            failCount++;
        }

        // Small delay to be nice to APIs
        if (i < CANDIDATES.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log(`\n🎉 Fix Process Complete!`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);

    // If any failures, do not exit with success code to alert user
    if (failCount > 0) {
        process.exit(1);
    }
}

fixFlaggedTweets();
