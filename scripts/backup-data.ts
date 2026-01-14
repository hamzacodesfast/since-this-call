/**
 * Backup Script - Exports all Redis data to a JSON file
 * Usage: npx tsx scripts/backup-data.ts
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

async function backup() {
    console.log('🔄 Starting backup...');

    const data: BackupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        recentAnalyses: [],
        userProfiles: {},
        userHistories: {},
        pumpfunPrices: {},
    };

    // 1. Backup recent_analyses
    console.log('📋 Backing up recent_analyses...');
    const recentAnalyses = await redis.lrange('recent_analyses', 0, -1);
    data.recentAnalyses = recentAnalyses.map(item =>
        typeof item === 'string' ? JSON.parse(item) : item
    );
    console.log(`   Found ${data.recentAnalyses.length} analyses`);

    // 2. Get all user keys and backup profiles/histories
    console.log('👤 Backing up user data...');

    // Get unique usernames from analyses
    const usernames = new Set<string>();
    data.recentAnalyses.forEach(a => {
        if (a.username) usernames.add(a.username.toLowerCase());
    });

    for (const username of usernames) {
        try {
            // Backup profile (stored as Hash)
            const profile = await redis.hgetall(`user:profile:${username}`);
            if (profile && Object.keys(profile).length > 0) {
                data.userProfiles[username] = profile;
            }
        } catch (e) {
            console.log(`   ⚠️ Skipping profile for ${username} (error: ${e})`);
        }

        try {
            // Backup history
            const history = await redis.lrange(`user:history:${username}`, 0, -1);
            if (history.length > 0) {
                data.userHistories[username] = history.map(item =>
                    typeof item === 'string' ? JSON.parse(item) : item
                );
            }
        } catch (e) {
            console.log(`   ⚠️ Skipping history for ${username} (different type)`);
        }
    }
    console.log(`   Found ${Object.keys(data.userProfiles).length} profiles`);

    // 3. Skip pumpfun prices for now (can be regenerated from analyses)
    console.log('💰 Skipping price data (can be regenerated from analyses)');

    // 4. Write to file
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup-${timestamp}.json`;
    const filepath = path.join(backupDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`\n✅ Backup complete!`);
    console.log(`   File: ${filepath}`);
    console.log(`   Size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);

    // Also create a "latest" symlink for easy access
    const latestPath = path.join(backupDir, 'latest.json');
    if (fs.existsSync(latestPath)) fs.unlinkSync(latestPath);
    fs.copyFileSync(filepath, latestPath);
    console.log(`   Latest: ${latestPath}`);

    process.exit(0);
}

backup().catch(err => {
    console.error('❌ Backup failed:', err);
    process.exit(1);
});
