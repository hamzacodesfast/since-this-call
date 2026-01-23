
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function main() {
    const username = process.argv[2];
    if (!username) {
        console.error('Please provide a username to fix.');
        process.exit(1);
    }

    console.log(`Fixing profile for: ${username}`);
    const key = `user:profile:${username.toLowerCase()}`;

    // 1. Delete Corrupted Key
    console.log(`Deleting potentially corrupted key: ${key}`);
    await redis.del(key);

    // 2. Import recalculate (dynamic import to ensure env loaded)
    const { recalculateUserProfile } = await import('../src/lib/analysis-store');

    // 3. Recalculate
    console.log('Recalculating profile from history...');
    await recalculateUserProfile(username);

    // 4. Verify
    const type = await redis.type(key);
    console.log(`New key type: ${type}`);

    if (type === 'hash') {
        const data = await redis.hgetall(key);
        console.log('✅ Fixed Profile:', data);
    } else {
        console.error('❌ Failed to fix profile (or history was empty)');
    }
}

main().catch(console.error);
