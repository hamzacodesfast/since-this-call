/**
 * @file run-trader-scan.ts
 * @description Script to execute STC Trader Agent V2 scans and output recommendations.
 */

import { runFullScan } from '../src/lib/trader-agent';
import { format } from 'date-fns';

async function main() {
    console.log('🚀 Starting STC Trader Agent V2 Scan...');
    console.log('Time:', format(new Date(), 'yyyy-MM-dd HH:mm:ss'));
    console.log('--------------------------------------------------');

    try {
        const result = await runFullScan();

        console.log('\n📊 SCAN SUMMARY');
        console.log(`Total Signals Found: ${result.totalSignals}`);
        console.log(`Scan Duration: ${((Date.now() - result.scanTimestamp) / 1000).toFixed(1)}s (ago)`);
        console.log('--------------------------------------------------');

        if (result.totalSignals === 0) {
            console.log('No high-probability signals found in this scan.');
            return;
        }

        const sections = [
            { title: '👑 APEX SIGNALS (Dual Sniper Confluence)', data: result.dualSniperSignals },
            { title: '🔄 SECTOR ROTATION ANOMALIES', data: result.sectorRotations },
            { title: '🧠 SMART MONEY DIVERGENCES', data: result.smartMoneyDivergences },
            { title: '🎯 SILENT SNIPER FOLLOWS', data: result.silentSnipers },
            { title: '🔄 INVERSE ENGAGEMENT FARMERS', data: result.farmerFades },
        ];

        for (const section of sections) {
            if (section.data.length > 0) {
                console.log(`\n${section.title}`);
                section.data.forEach((rec, i) => {
                    console.log(`\n[${i + 1}] ${rec.ticker} - ${rec.direction} (${rec.signal})`);
                    console.log(`    Confidence: ${rec.confidence}`);
                    console.log(`    Reasoning: ${rec.reasoning}`);
                    console.log(`    Staleness: ${rec.staleness}`);
                    if (rec.riskWarnings.length > 0) {
                        console.log(`    ⚠️ Risk Warnings:`);
                        rec.riskWarnings.forEach(w => console.log(`      - ${w}`));
                    }
                });
            }
        }

    } catch (error) {
        console.error('❌ Error during trader scan:', error);
        process.exit(1);
    }
}

main();
