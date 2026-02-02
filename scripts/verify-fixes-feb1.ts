
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';
// @ts-ignore
import { analyzeTweet } from '../src/lib/tweet-analyzer';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const redis = new Redis({
    url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const CORRECTIONS = [
    { id: '2017206400347251174', expected: 'SELL' }, // StonkChris
    { id: '2013359893537857841', expected: 'SELL', symbol: 'WHITEWHALE' }, // lynk0x
    { id: '2016251281162006886', expected: 'SELL' }, // ciniz
    { id: '2017213400363790434', expected: 'SELL' }, // RealSimpleAriel
    { id: '2013727702021239250', expected: 'BUY' }, // HolySmokas
    { id: '2017277409410863179', expected: 'BUY', symbol: 'DOG' }, // xLabundahx
    { id: '2015496762723582005', expected: 'BUY', symbol: 'ROSE' }, // cryptomacavalli
    { id: '2015245096716062726', expected: 'BUY' }  // voidsnam
];

async function verifyBatch() {
    console.log(`🔄 Verifying ${CORRECTIONS.length} corrections...`);

    for (const item of CORRECTIONS) {
        console.log(`\nRe-analyzing ${item.id}...`);
        try {
            // Force re-analysis with overridden symbol if needed for obscure tokens
            const result: any = await analyzeTweet(item.id, undefined, item.symbol);

            if (result.analysis.type === item.expected) {
                console.log(`✅ Success: ${item.id} -> ${result.analysis.type} (${result.analysis.symbol})`);

                // Update in DB (simulate reanalyze.ts effect)
                // In a real script we would call the update logic, but analyzeTweet just returns result.
                // We'll trust reanalyze.ts to do the actual saving if we ran it for real.
                // Here we just verify the AI logic works.

            } else {
                console.log(`❌ Failed: ${item.id} -> Got ${result.analysis.type}, Expected ${item.expected}`);
                console.log(`   Reason: ${result.analysis.reasoning}`);
            }
        } catch (e) {
            console.log(`❌ Error: ${item.id} - ${e}`);
        }
    }
}

// Mocking required context for analyzeTweet if it depends on running in full app context?
// analyzeTweet is imported from src/lib/tweet-analyzer.ts which should be self-contained enough.

verifyBatch();
