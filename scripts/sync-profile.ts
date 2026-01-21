
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const username = process.argv[2];

    if (!username) {
        console.error('❌ Usage: npx tsx scripts/sync-profile.ts <USERNAME>');
        process.exit(1);
    }

    // Dynamic import to ensure env vars are loaded first
    const { recalculateUserProfile } = await import('../src/lib/analysis-store');

    console.log(`🔄 Syncing profile for ${username}...`);
    await recalculateUserProfile(username);
    console.log('Done.');
    process.exit(0);
}

main();
