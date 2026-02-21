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
    try {
        console.log('🔄 Triggering Uniform Price Refresh...');
        execSync('npx tsx scripts/refresh-uniform-prices.ts', { stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Failed to run refresh-uniform-prices:', e);
        process.exit(1);
    }

    console.log('🔄 Triggering Profile Sync (Recalculate Stats)...');
    try {
        execSync('npx tsx scripts/recalculate-all-production.ts', { stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Failed to run recalculate-all-production:', e);
    }

    console.log('🔄 Triggering Ticker Backfill to sync stats...');
    try {
        execSync('npx tsx scripts/backfill-tickers.ts', { stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Failed to run backfill-tickers:', e);
    }

    console.log('🔄 Triggering Platform Metrics Refresh...');
    try {
        execSync('npx tsx scripts/refresh-metrics.ts', { stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Failed to run refresh-metrics:', e);
    }

    process.exit(0);
}

main();
