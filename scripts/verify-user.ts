/**
 * @file verify-user.ts
 * @description Admin script to set the isVerified flag for a guru.
 * 
 * Usage: npx tsx scripts/verify-user.ts <USERNAME> [true|false]
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getRedisClient } from '../src/lib/redis-client';
import { recalculateUserProfile } from '../src/lib/analysis-store';

const redis = getRedisClient();

async function main() {
    const username = process.argv[2];
    const verified = process.argv[3] !== 'false'; // Default to true

    if (!username) {
        console.error('Usage: npx tsx scripts/verify-user.ts <USERNAME> [true|false]');
        process.exit(1);
    }

    const lowerUser = username.toLowerCase();
    const profileKey = `user:profile:${lowerUser}`;

    // Check if user exists
    const exists = await redis.exists(profileKey);
    if (!exists) {
        console.error(`User ${username} not found in Redis.`);
        process.exit(1);
    }

    // Update the isVerified flag
    await redis.hset(profileKey, {
        isVerified: verified
    });

    // Optionally recalculate to ensure everything is in sync
    await recalculateUserProfile(username);

    console.log(`✅ User ${username} verification set to: ${verified}`);
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
