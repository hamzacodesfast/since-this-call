#!/usr/bin/env npx tsx
/**
 * @file run-trader-scan.ts
 * @description CLI runner for the STC Trader Agent — prints a formatted terminal report.
 *
 * Usage: npx tsx scripts/run-trader-scan.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { runFullScan, type TradeRecommendation } from '../src/lib/trader-agent';

const SIGNAL_EMOJI: Record<string, string> = {
    FADE: '🔄',
    COPY: '📋',
    MEAN_REVERSION: '🔀',
    MOMENTUM: '🚀',
    MAX_CONVICTION: '👑',
};

const CONFIDENCE_EMOJI: Record<string, string> = {
    LOW: '⚪',
    MEDIUM: '🟡',
    HIGH: '🟢',
    APEX: '💎',
};

function printRecommendation(rec: TradeRecommendation, index: number) {
    const dirEmoji = rec.direction === 'LONG' ? '📈' : '📉';
    const sigEmoji = SIGNAL_EMOJI[rec.signal] || '📊';
    const confEmoji = CONFIDENCE_EMOJI[rec.confidence] || '⚪';

    console.log(`\n  ${index + 1}. ${sigEmoji} ${rec.signal} ${dirEmoji} ${rec.direction} $${rec.ticker} (${rec.tickerType})`);
    console.log(`     ${confEmoji} Confidence: ${rec.confidence}`);
    console.log(`     🕐 ${rec.staleness}`);
    console.log(`     💡 ${rec.reasoning}`);

    // V2: Enhanced source account display
    for (const a of rec.sourceAccounts) {
        const parts = [`@${a.username} (${a.winRate.toFixed(1)}% WR, ${a.totalCalls} calls)`];
        if (a.enhanced) {
            const e = a.enhanced;
            if (e.tickerWinRate !== null) parts.push(`$${rec.ticker} WR: ${e.tickerWinRate.toFixed(0)}% (${e.tickerCalls}c)`);
            parts.push(`Recent: ${e.recentWinRate.toFixed(0)}% ${e.recentStreak}`);
            if (e.callConviction > 0 && e.callConviction !== 0.5) parts.push(`Conv: ${(e.callConviction * 100).toFixed(0)}%`);
        }
        console.log(`     👤 ${parts.join(' | ')}`);
    }

    if (rec.riskWarnings.length > 0) {
        console.log(`     ⚠️  ${rec.riskWarnings[0]}`);
    }
}

function printSection(title: string, recs: TradeRecommendation[]) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${'═'.repeat(60)}`);
    if (recs.length === 0) {
        console.log('  No signals detected.');
    } else {
        recs.forEach((r, i) => printRecommendation(r, i));
    }
}

async function main() {
    console.log('\n🔍 STC Trader Agent — Full Market Scan');
    console.log(`📅 ${new Date().toISOString()}\n`);

    const result = await runFullScan();

    printSection('🔥 PLAYBOOK 1: Inverse Engagement Farmer (FADE)', result.farmerFades);
    printSection('🎯 PLAYBOOK 2: Silent Sniper Follow (COPY)', result.silentSnipers);
    printSection('🧠 PLAYBOOK 3: Smart Money Divergence', result.smartMoneyDivergences);
    printSection('🔄 PLAYBOOK 4: Sector Rotation Anomaly', result.sectorRotations);
    printSection('👑 PLAYBOOK 5: Dual Sniper Confluence (APEX)', result.dualSniperSignals);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  📊 SCAN SUMMARY`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`  Total Signals:     ${result.totalSignals}`);
    console.log(`  Farmer Fades:      ${result.farmerFades.length}`);
    console.log(`  Silent Snipers:    ${result.silentSnipers.length}`);
    console.log(`  SM Divergences:    ${result.smartMoneyDivergences.length}`);
    console.log(`  Sector Rotations:  ${result.sectorRotations.length}`);
    console.log(`  Apex Signals:      ${result.dualSniperSignals.length}`);
    console.log(`\n  ⚠️  DISCLAIMER: These are data-driven observations, not financial advice.`);
    console.log(`  ⚠️  Never risk more than 2-3% of portfolio on any single recommendation.\n`);

    process.exit(0);
}

main();
