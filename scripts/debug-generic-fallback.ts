
import { getPrice } from '../src/lib/market-data';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    console.log("--- Testing Generic Fallback ---");

    // Test '67' (Should fallback to DexSearch)
    console.log("\n1. Testing '67' (Dex Fallback)...");
    const p67 = await getPrice('67', 'CRYPTO');
    console.log(`Price for 67: ${p67}`);

    // Test 'HYPE' (Should hit Yahoo HYPE32196-USD mapping first)
    console.log("\n2. Testing 'HYPE' (Yahoo Mapping)...");
    const pHype = await getPrice('HYPE', 'CRYPTO');
    console.log(`Price for HYPE: ${pHype}`);

    // Test Garbage (Should fail both)
    console.log("\n3. Testing 'XYZ123Garbage'...");
    const pGarbage = await getPrice('XYZ123Garbage', 'CRYPTO');
    console.log(`Price for XYZ123Garbage: ${pGarbage}`);
}
debug();
