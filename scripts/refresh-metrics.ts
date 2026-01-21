#!/usr/bin/env npx tsx
/**
 * @file refresh-metrics.ts
 * @description Script to manually refresh platform metrics
 * 
 * Usage: npx tsx scripts/refresh-metrics.ts
 */
import 'dotenv/config';

async function refreshMetrics() {
    console.log('🔄 Refreshing platform metrics...\n');

    const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

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
