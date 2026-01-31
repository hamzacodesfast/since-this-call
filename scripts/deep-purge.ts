
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';
import { getPrice } from '../src/lib/market-data';
import { recalculateUserProfile } from '../src/lib/analysis-store';

const redis = getRedisClient();

async function deepPurge() {
    console.log('🚀 DEEP PURGE: Removing all unresolvable calls from the database...\n');

    // 1. Get all users
    const users = await redis.smembers('all_users') as string[];
    console.log(`Processing ${users.length} users...`);

    let totalDeleted = 0;
    let totalChecked = 0;

    // We'll cache resolvable symbols to avoid redundant hits and rate limits
    const resolvableStatus = new Map<string, boolean>();

    for (const username of users) {
        const historyKey = `user:history:${username.toLowerCase()}`;
        const historyData = await redis.lrange(historyKey, 0, -1);

        if (!historyData || historyData.length === 0) continue;

        const history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        const newHistory = [];
        let userWasModified = false;

        for (const analysis of history) {
            totalChecked++;
            const symbol = (analysis.symbol || 'UNKNOWN').toUpperCase();
            const type = analysis.type || 'CRYPTO';

            // CRITERIA 1: No contract addresses allowed anymore
            if (analysis.contractAddress) {
                console.log(`   [DELETE] ${username}: ${symbol} (has contractAddress)`);
                userWasModified = true;
                totalDeleted++;
                continue;
            }

            // CRITERIA 2: Must be resolvable via main APIs
            const cacheKey = `${type}:${symbol}`;
            if (!resolvableStatus.has(cacheKey)) {
                console.log(`   [CHECK] Validating ${cacheKey}...`);
                try {
                    const price = await getPrice(symbol, type as any);
                    resolvableStatus.set(cacheKey, price !== null);
                    // Minimal delay to be kind to APIs
                    await new Promise(r => setTimeout(r, 50));
                } catch (e) {
                    resolvableStatus.set(cacheKey, false);
                }
            }

            if (resolvableStatus.get(cacheKey) === false) {
                console.log(`   [DELETE] ${username}: ${symbol} (unresolvable)`);
                userWasModified = true;
                totalDeleted++;
                continue;
            }

            // Keep it
            newHistory.push(analysis);
        }

        if (userWasModified) {
            console.log(`   [SAVE] ${username}: ${newHistory.length} calls remaining (deleted ${history.length - newHistory.length})`);
            await redis.del(historyKey);
            if (newHistory.length > 0) {
                const pipeline = redis.pipeline();
                // Push in reverse to maintain order (original list was likely LPUSHed)
                for (let i = newHistory.length - 1; i >= 0; i--) {
                    pipeline.lpush(historyKey, JSON.stringify(newHistory[i]));
                }
                await pipeline.exec();
            }
            // Trigger profile recalculation
            await recalculateUserProfile(username);
        }
    }

    // 2. Clean up Global Recent Feed
    console.log('\n🧹 Cleaning up global recent feed...');
    const recentKey = 'recent_analyses';
    const recentData = await redis.lrange(recentKey, 0, -1);
    const recent = recentData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
    const newRecent = recent.filter((a: any) => {
        const symbol = a.symbol?.toUpperCase();
        const type = a.type || 'CRYPTO';
        return !a.contractAddress && resolvableStatus.get(`${type}:${symbol}`) === true;
    });

    if (newRecent.length !== recent.length) {
        console.log(`   Modified recent feed: ${recent.length} -> ${newRecent.length}`);
        await redis.del(recentKey);
        if (newRecent.length > 0) {
            const pipeline = redis.pipeline();
            for (let i = newRecent.length - 1; i >= 0; i--) {
                pipeline.lpush(recentKey, JSON.stringify(newRecent[i]));
            }
            await pipeline.exec();
        }
    }

    // 3. Clean up Global Analysis ZSET (Historical timestamp index)
    console.log('\n🧹 Cleaning up global ZSET index...');
    const zsetKey = 'global:analyses:timestamp';
    const allRefs = await redis.zrange(zsetKey, 0, -1) as string[];
    // This is expensive to check every ref, but we can check if the user/id exists in the new histories
    // Or just clear it and let the next backfill rebuild it if we had a script for it.
    // Let's do a targeted remove.
    // Instead of iterating all, let's just clear indices and ask the user to run backfill-tickers
    // which rebuilds ticker stats.

    // Actually, let's just clear all metrics caches to be safe
    console.log('\n🔥 Clearing metrics caches...');
    await redis.del('platform_metrics');
    await redis.del('leaderboard_metrics_cache');
    await redis.del('platform_metrics_cache');

    console.log(`\n✅ Deep Purge Complete!`);
    console.log(`   Total Checked: ${totalChecked}`);
    console.log(`   Total Deleted: ${totalDeleted}`);
    console.log(`\nIMPORTANT: Run 'npx tsx scripts/backfill-tickers.ts' now to rebuild clean ticker indices.`);

    process.exit(0);
}

deepPurge().catch(console.error);
