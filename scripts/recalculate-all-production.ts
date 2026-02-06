
import * as dotenv from 'dotenv';
import * as path from 'path';

// 1. Force Production Environment
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function main() {
    // Dynamic import after env loaded
    const { getRedisClient } = await import('../src/lib/redis-client');
    const { recalculateUserProfile } = await import('../src/lib/analysis-store');

    const redis = getRedisClient();
    console.log('🔄 STARTING PRODUCTION PROFILE RECALCULATION...');

    const users = await redis.smembers('all_users');
    console.log(`[Recalc] Found ${users.length} users to process.`);

    let count = 0;
    for (const user of users) {
        try {
            await recalculateUserProfile(user);
            count++;
            if (count % 20 === 0) {
                console.log(`   Processed ${count}/${users.length} users...`);
            }
        } catch (e) {
            console.error(`   ❌ Failed for @${user}:`, e);
        }
    }

    console.log(`\n✨ DONE! Recalculated ${count} profiles.`);
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
