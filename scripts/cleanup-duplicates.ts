
/**
 * Cleanup duplicates in recent_analyses
 */

import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function cleanup() {
    console.log('🧹 Cleaning up duplicates in recent_analyses...');

    // Fetch all
    const rawData = await redis.lrange('recent_analyses', 0, -1);
    const items = rawData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);

    console.log(`Initial count: ${items.length}`);

    // Deduplicate (keep first occurrence of each ID)
    const seen = new Set();
    const uniqueItems: any[] = [];

    for (const item of items) {
        if (!seen.has(item.id)) {
            seen.add(item.id);
            uniqueItems.push(item);
        } else {
            console.log(`   - Removing duplicate for ${item.symbol} (${item.id})`);
        }
    }

    console.log(`Unique count: ${uniqueItems.length}`);
    console.log(`Removed: ${items.length - uniqueItems.length} duplicates`);

    if (items.length === uniqueItems.length) {
        console.log('✅ No duplicates found.');
        process.exit(0);
    }

    // Write back
    console.log('💾 Writing back sanitized list...');
    await redis.del('recent_analyses');

    // Write in batches or pipeline
    const pipeline = redis.pipeline();
    for (const item of uniqueItems) {
        pipeline.rpush('recent_analyses', JSON.stringify(item));
    }
    await pipeline.exec();

    console.log('✅ Cleanup complete!');
    process.exit(0);
}

cleanup();
