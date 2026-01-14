
import { getPrice } from '../src/lib/market-data';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    console.log("--- Debugging 67/SOL ---");
    const sym = "67/SOL";

    // Test getPrice
    console.log(`Checking getPrice("${sym}")...`);
    const price = await getPrice(sym, 'CRYPTO');
    console.log(`Result: ${price}`);

    // Test Search Logic manually to see why it fails
    // Code in market-data.ts filters for EXACT match "67/SOL" which fails.
    // It should clean the symbol.
}
debug();
