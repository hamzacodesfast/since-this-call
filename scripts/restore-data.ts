/**
 * Restore Script - Imports Redis data from a backup JSON file
 * Usage: npx tsx scripts/restore-data.ts [backup-file.json]
 * 
 * If no file is specified, uses backups/latest.json
 */

import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

interface BackupData {
    timestamp: string;
    version: string;
    recentAnalyses: any[];
    userProfiles: Record<string, any>;
    userHistories: Record<string, any[]>;
    pumpfunPrices: Record<string, any>;
}

async function restore() {
    // Determine which backup file to use
    const backupFile = process.argv[2] || path.join(process.cwd(), 'backups', 'latest.json');

    if (!fs.existsSync(backupFile)) {
        console.error(`❌ Backup file not found: ${backupFile}`);
        console.log('   Usage: npx tsx scripts/restore-data.ts [backup-file.json]');
        process.exit(1);
    }

    console.log(`🔄 Restoring from: ${backupFile}`);

    const rawData = fs.readFileSync(backupFile, 'utf-8');
    const data: BackupData = JSON.parse(rawData);

    console.log(`   Backup timestamp: ${data.timestamp}`);
    console.log(`   Version: ${data.version}`);
    console.log(`   Analyses: ${data.recentAnalyses.length}`);
    console.log(`   Profiles: ${Object.keys(data.userProfiles).length}`);
    console.log(`   Prices: ${Object.keys(data.pumpfunPrices).length}`);

    // Safety prompt
    console.log('\n⚠️  This will OVERWRITE existing data in Redis.');
    console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 1. Clear and restore recent_analyses
    console.log('📋 Restoring recent_analyses...');
    await redis.del('recent_analyses');
    if (data.recentAnalyses.length > 0) {
        // Push in reverse order since we're using lpush
        for (let i = data.recentAnalyses.length - 1; i >= 0; i--) {
            await redis.lpush('recent_analyses', JSON.stringify(data.recentAnalyses[i]));
        }
    }
    console.log(`   ✓ Restored ${data.recentAnalyses.length} analyses`);

    // 2. Restore user profiles
    console.log('👤 Restoring user profiles...');
    for (const [username, profile] of Object.entries(data.userProfiles)) {
        await redis.set(`user:profile:${username}`, JSON.stringify(profile));
    }
    console.log(`   ✓ Restored ${Object.keys(data.userProfiles).length} profiles`);

    // 3. Restore user histories
    console.log('📜 Restoring user histories...');
    for (const [username, history] of Object.entries(data.userHistories)) {
        await redis.del(`user:history:${username}`);
        if (history.length > 0) {
            for (let i = history.length - 1; i >= 0; i--) {
                await redis.lpush(`user:history:${username}`, JSON.stringify(history[i]));
            }
        }
    }
    console.log(`   ✓ Restored ${Object.keys(data.userHistories).length} user histories`);

    // 4. Restore pumpfun prices
    console.log('💰 Restoring price data...');
    for (const [key, value] of Object.entries(data.pumpfunPrices)) {
        await redis.set(key, value as any);
    }
    console.log(`   ✓ Restored ${Object.keys(data.pumpfunPrices).length} prices`);

    console.log('\n✅ Restore complete!');
    process.exit(0);
}

restore().catch(err => {
    console.error('❌ Restore failed:', err);
    process.exit(1);
});
