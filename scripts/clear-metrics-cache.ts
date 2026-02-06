#!/usr/bin/env npx tsx
/**
 * @file clear-metrics-cache.ts
 * @description Script to clear Redis metrics cache keys to force dashboard update.
 */
import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env files
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const redis = getRedisClient();

async function clearCache() {
    const CACHE_KEYS = [
        'global_metrics_cache',
        'leaderboard_cache',
        'platform_metrics'
    ];

    console.log('🧹 Clearing metrics cache...');
    for (const key of CACHE_KEYS) {
        const deleted = await redis.del(key);
        if (deleted) {
            console.log(`   ✅ Cleared: ${key}`);
        } else {
            console.log(`   ℹ️ Key not found: ${key}`);
        }
    }
    console.log('✨ Cache clearing complete.');
    process.exit(0);
}

clearCache().catch(e => {
    console.error('❌ Error clearing cache:', e);
    process.exit(1);
});
