
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';
import { recalculateUserProfile } from '../src/lib/analysis-store';

const redis = getRedisClient();

async function forceSync() {
    console.log('🔄 Force Syncing User Profiles...');
    const users = await redis.smembers('all_users') as string[];
    console.log(`Found ${users.length} users.`);

    let count = 0;
    for (const username of users) {
        process.stdout.write(`Syncing ${username}... `);
        await recalculateUserProfile(username);
        process.stdout.write('Done\n');
        count++;
    }

    // Force refresh platform metrics
    console.log('Regenerating platform metrics...');
    await redis.del('platform_metrics');

    // We can't easily call the API route logic directly without importing it or hitting localhost
    // But deleting the cache will force the next GET request to rebuild it.

    console.log(`✅ Synced ${count} profiles. Metrics cache cleared.`);
    process.exit(0);
}

forceSync().catch(console.error);
