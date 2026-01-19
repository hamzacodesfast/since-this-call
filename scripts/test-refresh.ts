
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    // Dynamic import to ensure env vars are loaded first
    const { refreshByTicker } = await import('../src/lib/price-refresher');

    console.log('🔄 Testing OPTIMIZED ticker-centric price refresh...\n');

    const startTime = Date.now();
    const result = await refreshByTicker();
    const duration = Date.now() - startTime;

    console.log('\n📊 Results:');
    console.log(`   Updated: ${result.updated}`);
    console.log(`   Skipped: ${result.skipped}`);
    console.log(`   Errors:  ${result.errors}`);
    console.log(`   Duration: ${duration}ms`);

    process.exit(0);
}

main();
