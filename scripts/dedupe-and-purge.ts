
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';
import { getPrice } from '../src/lib/market-data';
import { recalculateUserProfile } from '../src/lib/analysis-store';

const redis = getRedisClient();

async function dedupeAndPurge() {
    console.log('🚀 DEDUPE & PURGE: Cleaning up history lists...\n');

    const users = await redis.smembers('all_users') as string[];
    console.log(`Processing ${users.length} users...`);

    let totalDeleted = 0;
    let totalDeduped = 0;
    const resolvableStatus = new Map<string, boolean>();

    for (const username of users) {
        const historyKey = `user:history:${username.toLowerCase()}`;
        const historyData = await redis.lrange(historyKey, 0, -1);

        if (!historyData || historyData.length === 0) continue;

        const history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        const uniqueMap = new Map();
        let duplicatesFound = 0;

        // 1. DEDUPE
        for (const analysis of history) {
            // Use ID as unique key
            if (uniqueMap.has(analysis.id)) {
                duplicatesFound++;
                continue;
            }
            uniqueMap.set(analysis.id, analysis);
        }

        const dedupedHistory = Array.from(uniqueMap.values());
        if (duplicatesFound > 0) {
            // console.log(`   [DEDUPE] ${username}: Found ${duplicatesFound} duplicates.`);
            totalDeduped += duplicatesFound;
        }

        // 2. PURGE UNRESOLVABLE
        const finalHistory = [];
        let deletedThisUser = 0;

        for (const analysis of dedupedHistory) {
            const symbol = (analysis.symbol || 'UNKNOWN').toUpperCase();
            const type = analysis.type || 'CRYPTO';

            // Explicit CA check
            if (analysis.contractAddress && analysis.contractAddress.length > 5) {
                // console.log(`   [DELETE] ${username}: ${symbol} (has CA)`);
                deletedThisUser++;
                totalDeleted++;
                continue;
            }

            // Price Check
            const cacheKey = `${type}:${symbol}`;
            if (!resolvableStatus.has(cacheKey)) {
                try {
                    const price = await getPrice(symbol, type as any);
                    resolvableStatus.set(cacheKey, price !== null);
                    await new Promise(r => setTimeout(r, 20)); // throttle
                } catch (e) {
                    resolvableStatus.set(cacheKey, false);
                }
            }

            if (resolvableStatus.get(cacheKey) === false) {
                // console.log(`   [DELETE] ${username}: ${symbol} (unresolvable)`);
                deletedThisUser++;
                totalDeleted++;
                continue;
            }

            finalHistory.push(analysis);
        }

        // 3. SAVE IF CHANGED
        if (finalHistory.length !== history.length) {
            console.log(`   [SAVE] ${username}: ${history.length} -> ${finalHistory.length} (Deduped: ${duplicatesFound}, Purged: ${deletedThisUser})`);

            await redis.del(historyKey);

            if (finalHistory.length > 0) {
                const pipeline = redis.pipeline();
                // Push reversed to restore original order (newest first usually)
                // Actually, assuming history was [Newest, ..., Oldest]
                // lpush pushes to head.
                // so we push Oldest first.
                for (let i = finalHistory.length - 1; i >= 0; i--) {
                    pipeline.lpush(historyKey, JSON.stringify(finalHistory[i]));
                }
                await pipeline.exec();
            }

            await recalculateUserProfile(username);
        }
    }

    console.log('\n🧹 Clearing metrics caches...');
    await redis.del('platform_metrics');
    await redis.del('leaderboard_metrics_cache');
    await redis.del('platform_metrics_cache');

    console.log(`\n✅ Complete!`);
    console.log(`   Total Deduplicated: ${totalDeduped}`);
    console.log(`   Total Purged: ${totalDeleted}`);

    // Auto-trigger backfill-tickers just to be safe
    console.log('   (You should run backfill-tickers.ts next to align ticker profiles)');
    process.exit(0);
}

dedupeAndPurge().catch(console.error);
