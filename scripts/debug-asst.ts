
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Prod Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function debugAsst() {
    const { getPrice } = await import('../src/lib/market-data');

    console.log('--- Debugging ASST Data ---');

    // Tweet ID 2015662860425408527 implies roughly Jan 26, 2026
    // Let's use current time as a proxy or slightly earlier
    const now = new Date();

    console.log(`Fetching ASST for date: ${now.toISOString()}`);

    try {
        const price = await getPrice('ASST', 'STOCK', now);
        console.log(`[ASST] Price returned: ${price}`);
    } catch (e) {
        console.error(`[ASST] Error fetching:`, e);
    }

    console.log('--- Testing Current Price (No Date) ---');
    try {
        const current = await getPrice('ASST', 'STOCK');
        console.log(`[ASST] Current Price: ${current}`);
    } catch (e) {
        console.error(`[ASST] Error fetching current:`, e);
    }

    process.exit(0);
}

debugAsst();
