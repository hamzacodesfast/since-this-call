
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    // Dynamic import to ensure env vars are loaded first
    const { refreshAllProfiles } = await import('../src/lib/price-updater');
    await refreshAllProfiles(true);
    process.exit(0);
}

main();
