import * as dotenv from 'dotenv';
import * as path from 'path';

// Load production environment first (Main First)
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
    console.log('🔄 Refreshing all user profiles (Main First)...');
    // Dynamic import to ensure env vars are loaded first
    const { refreshAllProfiles } = await import('../src/lib/price-updater');
    await refreshAllProfiles(true);
    process.exit(0);
}

main();
