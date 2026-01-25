#!/usr/bin/env npx tsx
/**
 * @file refresh-metrics.ts
 * @description Script to manually refresh platform metrics
 * 
 * Usage: npx tsx scripts/refresh-metrics.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load production env if available
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function refreshMetrics() {
    const isLocal = process.argv.includes('--local');
    const baseUrl = process.env.PRODUCTION_URL ||
        (isLocal ? 'http://localhost:3000' : 'https://www.sincethiscall.com');

    console.log(`🔄 Refreshing platform metrics...`);
    console.log(`🔗 Target: ${baseUrl}\n`);

    try {
        const res = await fetch(`${baseUrl}/api/metrics`, {
            method: 'POST',
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to refresh');
        }

        console.log('✅ Metrics refreshed successfully!\n');
        console.log('📊 Current Stats:');
        console.log(`   Total Calls:    ${data.metrics.totalAnalyses.toLocaleString()}`);
        console.log(`   Unique Gurus:   ${data.metrics.uniqueGurus.toLocaleString()}`);
        console.log(`   Win Rate:       ${data.metrics.winRate}%`);
        console.log(`   Tracked Assets: ${data.metrics.uniqueTickers.toLocaleString()}`);
        console.log(`\n   Last Updated:   ${new Date(data.metrics.lastUpdated).toISOString()}`);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

refreshMetrics();
