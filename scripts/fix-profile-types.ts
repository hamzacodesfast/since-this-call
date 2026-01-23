
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function main() {
    console.log('Fixing profile types...');
    const users = await redis.smembers('all_users');
    console.log(`Checking ${users.length} users...`);

    let fixed = 0;
    for (const user of users) {
        const key = `user:profile:${user}`;
        // Check type
        const type = await redis.type(key);
        if (type !== 'hash' && type !== 'none') {
            console.log(`Found BAD type for ${user}: ${type}`);

            // It's likely a string, let's see what's in it just in case
            if (type === 'string') {
                const val = await redis.get(key);
                console.log(`Methods: ${val}`);
            }

            // Delete it so it can be regenerated as a Hash
            await redis.del(key);
            console.log(`Deleted bad key for ${user}`);
            fixed++;
        }
    }

    console.log(`Fixed ${fixed} profiles. Run backfill-profiles.ts to regenerate them.`);
}

main().catch(console.error);
