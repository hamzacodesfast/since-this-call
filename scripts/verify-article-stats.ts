
import * as dotenv from 'dotenv';
import * as path from 'path';
import { getRedisClient } from '../src/lib/redis-client';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const redis = getRedisClient();

async function verifyHypothesis() {
    console.log('🧪 Verifying the "Confidence vs Accuracy" Law...');

    const allUsers = await redis.smembers('all_users') as string[];
    let highConfidenceCalls = 0;
    let highConfidenceLosses = 0;
    let normalCalls = 0;
    let normalLosses = 0;
    let winDefinedCount = 0;
    let totalCallsChecked = 0;

    for (const user of allUsers) {
        const historyData = await redis.lrange(`user:history:${user}`, 0, -1);

        historyData.forEach(item => {
            const p = typeof item === 'string' ? JSON.parse(item) : item;
            totalCallsChecked++;

            // Allow isWin to be boolean or 0/1, and check isFlat
            if (p.isWin !== undefined && p.isWin !== null && !p.isFlat) {
                winDefinedCount++;
                const text = p.text || '';
                const exclamationCount = (text.match(/!/g) || []).length;

                if (exclamationCount >= 3) {
                    highConfidenceCalls++;
                    if (!p.isWin) highConfidenceLosses++;
                } else {
                    normalCalls++;
                    if (!p.isWin) normalLosses++;
                }
            }
        });
    }

    const highConfidenceFailRate = (highConfidenceLosses / (highConfidenceCalls || 1)) * 100;
    const normalFailRate = (normalLosses / (normalCalls || 1)) * 100;

    console.log(`\n📊 DATA RESULTS:`);
    console.log(`Total Records Checked: ${totalCallsChecked}`);
    console.log(`Records with Win/Loss: ${winDefinedCount}`);
    console.log(`High Confidence (3+ !): ${highConfidenceCalls} calls | Fail Rate: ${highConfidenceFailRate.toFixed(1)}%`);
    console.log(`Normal Confidence: ${normalCalls} calls | Fail Rate: ${normalFailRate.toFixed(1)}%`);

    if (highConfidenceFailRate > normalFailRate && highConfidenceCalls > 0) {
        const diff = highConfidenceFailRate - normalFailRate;
        const pctIncrease = (diff / (normalFailRate || 1)) * 100;
        console.log(`\n✅ HYPOTHESIS CONFIRMED: High Confidence calls fail ${pctIncrease.toFixed(1)}% more often.`);
    } else {
        console.log(`\n❌ HYPOTHESIS REJECTED: Tone does not correlate with failure in this sample.`);
    }

    process.exit(0);
}

verifyHypothesis();
