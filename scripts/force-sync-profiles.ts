
import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
    // Dynamic import to ensure env vars loaded
    const { recalculateUserProfile } = await import('../src/lib/analysis-store');
    const redis = getRedisClient();

    console.log('🔄 Force-Syncing User Profiles...');

    const users = await redis.smembers('all_users');
    console.log(`   Found ${users.length} users.`);

    let count = 0;
    for (const user of users) {
        try {
            await recalculateUserProfile(user);
            count++;
            if (count % 50 === 0) process.stdout.write(`   Synced ${count} profiles...\r`);
        } catch (e) {
            console.error(`   ❌ Failed to sync ${user}:`, e);
        }
    }

    console.log(`\n✅ Synced ${count}/${users.length} profiles successfully.`);
    process.exit(0);
}

main();
