
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function main() {
    console.log('Searching for corrupted profiles...');
    const users = await redis.smembers('all_users');
    let issues = 0;

    for (const user of users) {
        const key = `user:profile:${user}`;
        const profile = await redis.hgetall(key);

        if (!profile) {
            console.warn(`[MISSING] Profile for ${user} is null/empty`);
            issues++;
            continue;
        }

        // Check for NaN or null in numbers
        if (isNaN(parseInt(profile.wins)) || isNaN(parseInt(profile.losses)) || isNaN(parseInt(profile.totalAnalyses))) {
            console.error(`[NAN] Profile for ${user} has non-numeric stats:`, profile);
            issues++;
        }

        if (!profile.winRate || isNaN(parseFloat(profile.winRate))) {
            console.error(`[BAD WINRATE] Profile for ${user} has invalid winRate:`, profile.winRate);
            issues++;
        }

        if (profile.avgPerformance && profile.avgPerformance.includes('NaN')) {
            console.error(`[NAN PERF] Profile for ${user} has NaN performance`);
            issues++;
        }
    }

    console.log(`Scan complete. Found ${issues} potential issues.`);
}

main().catch(console.error);
