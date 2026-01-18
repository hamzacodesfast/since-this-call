
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const USERNAME = 'aster_dex';

async function main() {
    // Dynamic import to ensure env vars are loaded first
    const { recalculateUserProfile } = await import('../src/lib/analysis-store');

    console.log(`🔄 Syncing profile for ${USERNAME}...`);
    await recalculateUserProfile(USERNAME);
    console.log('Done.');
    process.exit(0);
}

main();
