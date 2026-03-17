/**
 * Backup Script - Exports all Redis data to a JSON file
 * Usage: npx tsx scripts/backup-data.ts
 */

import { LocalRedisWrapper } from '../src/lib/redis-wrapper';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Use local wrapper which connects to 6379 directly
const redis = new LocalRedisWrapper(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || 'redis://localhost:6379');

interface BackupData {
    timestamp: string;
    version: string;
    recentAnalyses: any[];
    userProfiles: Record<string, any>;
    userHistories: Record<string, any[]>;
    pumpfunPrices: Record<string, any>;
    trackedTickers: string[];
    tickerProfiles: Record<string, any>;
    tickerIndices: Record<string, any[]>;
}

async function backup() {
    console.log('🔄 Starting backup (Local Native)...');

    const data: BackupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        recentAnalyses: [],
        userProfiles: {},
        userHistories: {},
        pumpfunPrices: {},
        trackedTickers: [],
        tickerProfiles: {},
        tickerIndices: {},
    };

    // 1. Backup recent_analyses
    console.log('📋 Backing up recent_analyses...');
    const recentAnalyses = await redis.lrange('recent_analyses', 0, -1);
    data.recentAnalyses = recentAnalyses;
    console.log(`   Found ${data.recentAnalyses.length} analyses`);

    // 2. Get all user keys from all_users set
    console.log('👤 Backing up user data...');
    const usernames = await redis.smembers('all_users');
    console.log(`   Found ${usernames.length} users in all_users set`);

    const CHUNK_SIZE = 100;
    for (let i = 0; i < usernames.length; i += CHUNK_SIZE) {
        const chunk = usernames.slice(i, i + CHUNK_SIZE);
        const pipe = redis.pipeline();
        
        for (const username of chunk) {
            pipe.hgetall(`user:profile:${username}`);
            pipe.lrange(`user:history:${username}`, 0, -1);
        }
        
        const results = await pipe.exec();
        
        for (let j = 0; j < chunk.length; j++) {
            const username = chunk[j];
            const profile = (Array.isArray(results[j*2]) ? results[j*2][1] : results[j*2]) as any;
            const history = (Array.isArray(results[j*2+1]) ? results[j*2+1][1] : results[j*2+1]) as any[];
            
            if (profile && Object.keys(profile).length > 0) {
                data.userProfiles[username] = profile;
            }
            if (history && history.length > 0) {
                data.userHistories[username] = history;
            }
        }
        console.log(`   [Backup] Processed ${Math.min(i + CHUNK_SIZE, usernames.length)}/${usernames.length} users...`);
    }

    console.log(`   Exported ${Object.keys(data.userProfiles).length} profiles`);
    console.log(`   Exported ${Object.keys(data.userHistories).length} histories`);

    // 3. Backup Tickers
    console.log('📈 Backing up ticker data...');
    const tickers = await redis.smembers('tracked_tickers');
    data.trackedTickers = tickers;
    console.log(`   Found ${tickers.length} tracked tickers`);

    // Batch tickers
    const TICKER_CHUNK = 100;
    for (let i = 0; i < tickers.length; i += TICKER_CHUNK) {
        const chunk = tickers.slice(i, i + TICKER_CHUNK);
        const pipe = redis.pipeline();
        for (const ticker of chunk) {
            pipe.hgetall(`ticker:profile:${ticker}`);
            pipe.zrange(`ticker_index:${ticker}`, 0, -1, { withScores: true });
        }
        const results = await pipe.exec();
        for (let j = 0; j < chunk.length; j++) {
            const ticker = chunk[j];
            const profile = (Array.isArray(results[j*2]) ? results[j*2][1] : results[j*2]) as any;
            const index = (Array.isArray(results[j*2+1]) ? results[j*2+1][1] : results[j*2+1]) as any[];
            if (profile) data.tickerProfiles[ticker] = profile;
            if (index && index.length > 0) data.tickerIndices[ticker] = index;
        }
        console.log(`   [Backup] Processed ${Math.min(i + TICKER_CHUNK, tickers.length)}/${tickers.length} tickers...`);
    }
    console.log(`   Exported ${Object.keys(data.tickerProfiles).length} ticker profiles`);

    // 4. Skip pumpfun prices for now (can be regenerated from analyses)
    console.log('💰 Skipping price data (can be regenerated from analyses)');

    // 4. Write to file
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const filename = `local_database_backup.json`;
    const filepath = path.join(backupDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`\n✅ Backup complete!`);
    console.log(`   File: ${filepath}`);
    console.log(`   Size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);

    process.exit(0);
}

backup().catch(err => {
    console.error('❌ Backup failed:', err);
    process.exit(1);
});
