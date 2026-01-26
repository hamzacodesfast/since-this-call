
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Prod Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function verifyGold() {
    const { getPrice } = await import('../src/lib/market-data');

    console.log('--- Verifying Gold Data ---');

    const gld = await getPrice('GLD');
    console.log(`GLD (ETF): ${gld}`);

    const futures = await getPrice('GC=F');
    console.log(`GC=F (Futures): ${futures}`);

    process.exit(0);
}

verifyGold();
