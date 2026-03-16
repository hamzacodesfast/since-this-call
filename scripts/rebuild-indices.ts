/**
 * @file rebuild-indices.ts
 * @description Rebuilds all global indices (ZSETs and Lists) from user history data.
 * Run this when profiles are present but global counts/recent feeds are 0.
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
const GLOBAL_INDEX = 'global:analyses:timestamp';
const RECENT_KEY = 'recent_analyses';
const MAX_RECENT = 50;

async function main() {
    console.log('🔄 REBUILDING ALL GLOBAL INDICES...');

    // 1. Get all users
    const allUsers = await redis.smembers('all_users') as string[];
    console.log(`[Rebuild] Found ${allUsers.length} users.`);

    // 2. Collect all analyses
    const allAnalyses: StoredAnalysis[] = [];

    let processedUsers = 0;
    for (const user of allUsers) {
        const historyData = await redis.lrange(`user:history:${user}`, 0, -1);
        const history: StoredAnalysis[] = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        allAnalyses.push(...history);

        processedUsers++;
        if (processedUsers % 500 === 0) {
            console.log(`   Processed ${processedUsers}/${allUsers.length} users...`);
        }
    }

    console.log(`[Rebuild] Collected ${allAnalyses.length} total analyses.`);

    // 3. Rebuild Global Index (ZSET)
    console.log(`[Rebuild] Rebuilding ${GLOBAL_INDEX}...`);
    await redis.del(GLOBAL_INDEX);
    const indexPipe = redis.pipeline();
    
    // Chunking to avoid massive pipelines
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < allAnalyses.length; i += CHUNK_SIZE) {
        const chunk = allAnalyses.slice(i, i + CHUNK_SIZE);
        for (const a of chunk) {
            const ref = `${a.username.toLowerCase()}:${a.id}`;
            indexPipe.zadd(GLOBAL_INDEX, { score: a.timestamp, member: ref });
        }
        await indexPipe.exec();
        console.log(`   Indexed ${Math.min(i + CHUNK_SIZE, allAnalyses.length)} analyses...`);
    }

    // 4. Rebuild Recent Feed (List)
    console.log(`[Rebuild] Rebuilding ${RECENT_KEY}...`);
    allAnalyses.sort((a, b) => b.timestamp - a.timestamp);
    const recent = allAnalyses.slice(0, MAX_RECENT);
    
    await redis.del(RECENT_KEY);
    const recentPipe = redis.pipeline();
    for (let i = recent.length - 1; i >= 0; i--) {
        recentPipe.lpush(RECENT_KEY, JSON.stringify(recent[i]));
    }
    await recentPipe.exec();

    console.log('\n✨ ALL INDICES REBUILT SUCCESSFULLY!');
    console.log(`📊 Global analyses indexed: ${allAnalyses.length}`);
    console.log(`📊 Recent feed populated:   ${recent.length}`);

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
