
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function main() {
    console.log('Restoring all_users index...');

    // Scan for all user:history:* keys
    let cursor = 0;
    const users = new Set<string>();

    do {
        const reply = await redis.scan(cursor, { match: 'user:history:*', count: 100 });
        cursor = reply[0];
        const keys = reply[1];

        for (const key of keys) {
            // key format: user:history:username
            const parts = key.split(':');
            if (parts.length === 3) {
                users.add(parts[2]);
            }
        }
    } while (cursor !== 0);

    console.log(`Found ${users.size} user histories.`);

    if (users.size > 0) {
        await redis.sadd('all_users', ...Array.from(users));
        console.log('Restored all_users set.');
    }

    // Optional: Recalculate profiles for everyone to ensure consistency
    console.log('Recalculating profiles for all users...');
    const { recalculateUserProfile } = await import('../src/lib/analysis-store');

    let count = 0;
    for (const user of users) {
        await recalculateUserProfile(user);
        count++;
        if (count % 10 === 0) process.stdout.write('.');
    }

    console.log(`\nDone. Processed ${count} users.`);
}

main().catch(console.error);
