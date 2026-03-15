import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';

// Load production environment first (Main First)
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
    console.log('🔄 STARTING OPTIMIZED PLATFORM REFRESH...');
    
    // We only need to run these in a specific order. 
    // refresh-stats was previously running them all, but the user's manual command also ran them.
    
    try {
        console.log('1️⃣  Refreshing Latest Prices...');
        execSync('npx tsx scripts/refresh-uniform-prices.ts', { stdio: 'inherit' });
        
        console.log('2️⃣  Refreshing Platform Metrics (Expensive aggregation)...');
        execSync('npx tsx scripts/refresh-metrics.ts', { stdio: 'inherit' });

        console.log('\n✅ All core stats refreshed.');
    } catch (e) {
        console.error('❌ Failed during refresh:', e);
        process.exit(1);
    }

    process.exit(0);
}

main();
