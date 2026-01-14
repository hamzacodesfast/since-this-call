
import { getPrice } from '../src/lib/market-data';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    console.log("--- Testing GeckoTerminal Integration ---");

    // Test '67' (Should hit GT Minute Logic)
    console.log("\n1. Testing '67' Hist (1 hour ago) - Expect GT Minute Precision");
    const d1 = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const p67 = await getPrice('67', 'CRYPTO', d1);
    console.log(`Price for 67 (-1h): ${p67}`);

    // Test 'SOL' (Wait, SOL mapped to Yahoo... How to test Dex path for SOL?)
    // Need to pass a symbol NOT in Yahoo map. e.g. 'WSOL'? Or generic.
    // Or just trust '67' test.
}
debug();
