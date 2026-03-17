/**
 * Restore Script - Imports data from a JSON backup to Redis
 * Usage: npx tsx scripts/restore-data.ts <backup_file.json>
 */

import { LocalRedisWrapper } from '../src/lib/redis-wrapper';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Use local wrapper which connects to 6379 directly
const redis = new LocalRedisWrapper(process.env.REDIS_URL || 'redis://localhost:6379');

interface BackupData {
    timestamp: string;
    version: string;
    recentAnalyses: any[];
    userProfiles: Record<string, any>;
    userHistories: Record<string, any[]>;
    trackedTickers: string[];
    tickerProfiles: Record<string, any>;
    tickerIndices: Record<string, any[]>;
}

async function restore() {
    const backupFile = process.argv[2];
    if (!backupFile) {
        console.error('❌ Please provide a backup file path.');
        process.exit(1);
    }

    console.log(`🔄 Starting restore from ${backupFile}...`);
    
    const data: BackupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    console.log(`📅 Backup timestamp: ${data.timestamp}`);

    // 1. Restore recent_analyses
    if (data.recentAnalyses && data.recentAnalyses.length > 0) {
        console.log(`📋 Restoring ${data.recentAnalyses.length} recent_analyses...`);
        await redis.del('recent_analyses');
        // Push in reverse order to maintain correct order if rpush/lpush is used
        await redis.rpush('recent_analyses', ...data.recentAnalyses);
    }

    // 2. Restore User Data
    console.log('👤 Restoring user data...');
    const usernames = Object.keys(data.userProfiles);
    for (const username of usernames) {
        await redis.sadd('all_users', username);
        await redis.hset(`user:profile:${username}`, data.userProfiles[username]);
        if (data.userHistories[username]) {
            await redis.del(`user:history:${username}`);
            await redis.rpush(`user:history:${username}`, ...data.userHistories[username]);
        }
    }
    console.log(`   Restored ${usernames.length} users`);

    // 3. Restore Tickers
    console.log('📈 Restoring ticker data...');
    const tickers = data.trackedTickers || [];
    for (const ticker of tickers) {
        await redis.sadd('tracked_tickers', ticker);
        if (data.tickerProfiles[ticker]) {
            await redis.hset(`ticker:profile:${ticker}`, data.tickerProfiles[ticker]);
        }
        if (data.tickerIndices[ticker]) {
            await redis.del(`ticker_index:${ticker}`);
            // tickerIndices is likely [score, member, score, member...] from persistence
            const index = data.tickerIndices[ticker];
            for (let i = 0; i < index.length; i += 2) {
                await redis.zadd(`ticker_index:${ticker}`, { 
                    score: parseFloat(index[i+1]), 
                    member: index[i] 
                });
            }
        }
    }
    console.log(`   Restored ${tickers.length} tickers`);

    console.log(`\n✅ Restore complete!`);
    process.exit(0);
}

restore().catch(err => {
    console.error('❌ Restore failed:', err);
    process.exit(1);
});
