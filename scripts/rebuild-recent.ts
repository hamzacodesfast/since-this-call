/**
 * @file rebuild-recent.ts
 * @description Rebuilds the recent_analyses list from user history data.
 * Run this when recent_analyses is empty but user histories exist.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load production environment
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';
import { StoredAnalysis } from '../src/lib/analysis-store';

const redis = getRedisClient();
const RECENT_KEY = 'recent_analyses';
const MAX_RECENT = 50;

async function main() {
    console.log('🔄 Rebuilding recent_analyses from user histories...');

    // 1. Get all users
    const allUsers = await redis.smembers('all_users') as string[];
    console.log(`[Rebuild] Found ${allUsers.length} users.`);

    // 2. Collect all analyses from all users
    const allAnalyses: StoredAnalysis[] = [];

    let processedUsers = 0;
    for (const user of allUsers) {
        const historyData = await redis.lrange(`user:history:${user}`, 0, -1);
        const history: StoredAnalysis[] = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        allAnalyses.push(...history);

        processedUsers++;
        if (processedUsers % 100 === 0) {
            console.log(`   Processed ${processedUsers}/${allUsers.length} users...`);
        }
    }

    console.log(`[Rebuild] Collected ${allAnalyses.length} total analyses.`);

    // 3. Sort by timestamp (newest first)
    allAnalyses.sort((a, b) => b.timestamp - a.timestamp);

    // 4. Take the most recent 50
    const recentAnalyses = allAnalyses.slice(0, MAX_RECENT);
    console.log(`[Rebuild] Taking ${recentAnalyses.length} most recent for recent_analyses.`);

    // 5. Clear and rebuild recent_analyses
    await redis.del(RECENT_KEY);

    const pipeline = redis.pipeline();
    // RPUSH in order to maintain correct order (oldest to newest for LPUSH would reverse)
    // Actually, we want newest at index 0. So we LPUSH in reverse order (oldest first).
    for (let i = recentAnalyses.length - 1; i >= 0; i--) {
        pipeline.lpush(RECENT_KEY, JSON.stringify(recentAnalyses[i]));
    }
    await pipeline.exec();

    console.log(`\n✅ Rebuilt recent_analyses with ${recentAnalyses.length} items!`);

    // Show a sample
    if (recentAnalyses.length > 0) {
        const newest = recentAnalyses[0];
        console.log(`   Newest: @${newest.username} - ${newest.symbol} (${new Date(newest.timestamp).toISOString()})`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
