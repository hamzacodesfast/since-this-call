
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Prod Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function checkPrice() {
    const { getPrice } = await import('../src/lib/market-data');

    console.log('Fetching HYPE price...');
    const price = await getPrice('HYPE', 'CRYPTO');
    console.log(`HYPE Price: $${price}`);
    process.exit(0);
}

checkPrice();
