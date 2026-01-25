
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runTest() {
    console.log('🧪 Testing Market Context Injection & MSTR logic...');

    // 1. Test inferAssetType
    const { inferAssetType, getMajorIndicesPrices } = await import('../src/lib/market-data');

    console.log('\n🔍 Testing Type Inference:');
    const cases = ['BTC', 'ETH', 'MSTR', 'COIN', 'AAPL', 'PEPE'];
    for (const c of cases) {
        console.log(`  ${c} -> ${inferAssetType(c)}`);
    }

    // 2. Test Major Indices Fetch
    console.log('\n📊 Testing Major Indices Fetch:');
    const indices = await getMajorIndicesPrices();
    console.log('  indices:', indices);

    if (indices['BTC'] > 0 && indices['ETH'] > 0) {
        console.log('  ✅ Indices fetch successful');
    } else {
        console.error('  ❌ Indices fetch failed or returned 0');
    }

    // 3. Test AI Extractor with Mock Context
    const { extractCallFromText } = await import('../src/lib/ai-extractor');

    console.log('\n🤖 Testing AI Extraction (MSTR Proxy Rule):');
    const tweetText = "MicroStrategy has acquired 12,000 more BTC for ~$800M using proceeds from convertible notes & excess cash.";
    const tweetDate = new Date().toISOString();

    // We expect Ticker: BTC (Proxy Rule)
    const result = await extractCallFromText(
        tweetText,
        tweetDate,
        undefined,
        undefined,
        indices
    );

    console.log('\n  Input:', tweetText);
    console.log('  Result:', JSON.stringify(result, null, 2));

    if (result?.ticker === 'BTC') {
        console.log('  ✅ Proxy Rule verified (MSTR -> BTC)');
    } else {
        console.error('  ❌ Proxy Rule failed');
    }
}

runTest();
