
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Prod Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function syncProfile() {
    const { recalculateUserProfile } = await import('../src/lib/analysis-store');

    const username = 'incomesharks';
    console.log(`🔄 Syncing profile stats for @${username}...`);

    try {
        await recalculateUserProfile(username);
        console.log('✅ Sync complete.');
    } catch (e) {
        console.error('❌ Sync failed:', e);
    }

    process.exit(0);
}

syncProfile();
