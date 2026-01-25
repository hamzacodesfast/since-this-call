
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Prod Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function syncAllProfiles() {
    console.log('🔄 Starting Global Profile Sync...');

    const { recalculateUserProfile } = await import('../src/lib/analysis-store');
    const { getRedisClient } = await import('../src/lib/redis-client');

    const redis = getRedisClient();

    try {
        // Get all users
        const users = await redis.smembers('all_users');
        console.log(`Found ${users.length} users to sync.`);

        for (const user of users) {
            const username = user as string;
            process.stdout.write(`Syncing @${username}... `);
            try {
                await recalculateUserProfile(username);
                // console.log('Done'); // logic logs this anyway
            } catch (err) {
                console.error(`Failed: ${err}`);
            }
        }

        console.log('\n✅ Global Sync Complete.');

    } catch (e) {
        console.error('❌ Global Sync Failed:', e);
    }

    process.exit(0);
}

syncAllProfiles();
