
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Prod Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function verifyStocks() {
    const { getPrice, inferAssetType } = await import('../src/lib/market-data');

    const tickers = ['COIN', 'ONDS', 'ASST', 'GLD'];

    console.log('--- Verifying Stock Data ---');

    for (const ticker of tickers) {
        const type = inferAssetType(ticker);
        console.log(`[${ticker}] Inferred Type: ${type}`);

        try {
            const price = await getPrice(ticker);
            console.log(`[${ticker}] Price: ${price ? '$' + price.toFixed(2) : 'NULL'}`);
        } catch (e) {
            console.error(`[${ticker}] Error fetching:`, e);
        }
        console.log('---');
    }

    process.exit(0);
}

verifyStocks();
