
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load Env in correct order (Local first)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';
import { getPrice } from '../src/lib/market-data';
import { recalculateUserProfile } from '../src/lib/analysis-store';

const redis = getRedisClient();

async function forceNukeAndRebuild() {
    console.log('☢️  FORCE NUKE & REBUILD: Rewriting every user history...\n');

    const users = await redis.smembers('all_users') as string[];
    console.log(`Processing ${users.length} users...`);

    let totalDeleted = 0;

    // Cache for price resolution
    const priceCache = new Map<string, boolean>();

    for (const username of users) {
        const historyKey = `user:history:${username.toLowerCase()}`;
        const lenBefore = await redis.llen(historyKey);

        if (lenBefore === 0) continue;

        const historyData = await redis.lrange(historyKey, 0, -1);
        const history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        // FILTER
        const cleanHistory = [];
        const seenIds = new Set();

        for (const analysis of history) {
            // 1. Dedupe by ID
            if (seenIds.has(analysis.id)) continue;
            seenIds.add(analysis.id);

            // 2. Criteria: No Contract Address (Strict)
            if (analysis.contractAddress) {
                totalDeleted++;
                continue;
            }

            // 3. Criteria: Resolvable Price
            const symbol = (analysis.symbol || 'UNKNOWN').toUpperCase();
            const type = analysis.type || 'CRYPTO';
            const cacheKey = `${type}:${symbol}`;

            if (!priceCache.has(cacheKey)) {
                try {
                    const price = await getPrice(symbol, type as any);
                    priceCache.set(cacheKey, price !== null);
                    await new Promise(r => setTimeout(r, 10)); // tiny throttle
                } catch {
                    priceCache.set(cacheKey, false);
                }
            }

            if (priceCache.get(cacheKey) === false) {
                totalDeleted++;
                continue;
            }

            cleanHistory.push(analysis);
        }

        // ALWAYS REWRITE if length > 0 or if it changed
        // This ensures even "hidden" corruption is fixed.
        // If cleanHistory is same as history, we still rewrite to ensure clean JSON strings?
        // No, only if length diff or we want to be paranoid.
        // Let's be paranoid if length differs.

        if (cleanHistory.length !== history.length) {
            // console.log(`   [FIX] ${username}: ${history.length} -> ${cleanHistory.length}`);

            // DELETE
            await redis.del(historyKey);

            // VERIFY DELETE
            const check = await redis.llen(historyKey);
            if (check !== 0) {
                console.error(`   🚨 CRITICAL: Failed to delete ${historyKey}. Manual intervention needed.`);
                // Force delete again?
                await redis.del(historyKey);
            }

            // WRITE BACK
            if (cleanHistory.length > 0) {
                // Use pipeline for speed, but simple
                const p = redis.pipeline();
                // Push reversed (Oldest first) so LINDEX 0 is Newest? 
                // WAIT. LRANGE 0 -1 returns [Newest, ..., Oldest] typically if we LPUSH new items.
                // If we LPUSH [A, B, C], list is [C, B, A].
                // If distinct calls were LPUSHed over time: Call1, then Call2.
                // List: [Call2, Call1].
                // We want to preserve this order.
                // So we must LPUSH Call1 (Oldest), then Call2 (Newest).
                // cleanHistory from LRANGE is [Newest, ..., Oldest].
                // So we iterate cleanHistory BACKWARDS (Oldest first) and LPUSH.

                for (let i = cleanHistory.length - 1; i >= 0; i--) {
                    p.lpush(historyKey, JSON.stringify(cleanHistory[i]));
                }
                await p.exec();
            }

            // RECALCULATE PROFILE
            await recalculateUserProfile(username);
        }
    }

    console.log('\n🧹 Clearing ALL caches...');
    await redis.del('platform_metrics');
    await redis.del('leaderboard_metrics_cache');
    await redis.del('platform_metrics_cache');
    await redis.del('tracked_tickers'); // Force full rebuild of this tracking set

    // Clean up index too
    await redis.del('global:analyses:timestamp');

    console.log(`\n✅ Nuke Complete!`);
    console.log(`   Items Removed: ${totalDeleted}`);

    console.log('\n👉 Running post-cleanup tasks (Rebuild Index + Backfill)...');
    process.exit(0);
}

forceNukeAndRebuild().catch(console.error);
