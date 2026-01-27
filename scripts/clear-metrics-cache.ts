
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';

async function clearCache() {
    const redis = getRedisClient();
    await redis.del('platform_metrics');
    console.log('✅ platform_metrics cache cleared');
    process.exit(0);
}

clearCache();
