/**
 * Fix misclassified tickers (MSTR, PLTR should be STOCK not CRYPTO)
 */

import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const FIXES = [
    { old: 'CRYPTO:MSTR', new: 'STOCK:MSTR' },
    { old: 'CRYPTO:PLTR', new: 'STOCK:PLTR' },
];

async function fixTickerClassification() {
    console.log('🔧 Fixing ticker classifications...\n');

    for (const fix of FIXES) {
        // Check if old ticker exists
        const oldExists = await redis.sismember('tracked_tickers', fix.old);
        if (!oldExists) {
            console.log(`⏭️  ${fix.old} not found, skipping`);
            continue;
        }

        // Get all analysis refs for old ticker
        const oldIndexKey = `ticker_index:${fix.old}`;
        const refs = await redis.smembers(oldIndexKey) as string[];

        if (refs.length === 0) {
            console.log(`⏭️  ${fix.old} has no refs, skipping`);
            continue;
        }

        console.log(`📝 Migrating ${fix.old} → ${fix.new} (${refs.length} refs)`);

        // Add new ticker to tracked set
        await redis.sadd('tracked_tickers', fix.new);

        // Move refs to new index
        const newIndexKey = `ticker_index:${fix.new}`;
        for (const ref of refs) {
            await redis.sadd(newIndexKey, ref);
        }

        // Remove old index and ticker
        await redis.del(oldIndexKey);
        await redis.srem('tracked_tickers', fix.old);

        console.log(`✅ Done: ${fix.old} → ${fix.new}`);
    }

    console.log('\n🎉 Classification fix complete!');
    process.exit(0);
}

fixTickerClassification();
