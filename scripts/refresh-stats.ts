import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';

// Load production environment first (Main First)
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
    console.log('🔄 Refreshing all user profiles (Main First)...');
    // Dynamic import to ensure env vars are loaded first
    const { refreshAllProfiles } = await import('../src/lib/price-updater');
    await refreshAllProfiles(true);

    console.log('🔄 Triggering Ticker Backfill to sync stats...');
    try {
        execSync('npx tsx scripts/backfill-tickers.ts', { stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Failed to run backfill-tickers:', e);
    }

    process.exit(0);
}

main();
