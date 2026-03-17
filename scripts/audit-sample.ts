
import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function auditSample() {
    const redis = getRedisClient();
    console.log('🔍 Sampling users for audit...');

    const users = await redis.smembers('all_users');
    const sampleSize = 100;
    const sample = users.slice(0, sampleSize);
    
    console.log(`Auditing ${sample.length} users out of ${users.length}...`);

    let totalAnalyses = 0;
    let issues = 0;
    const issuesList: any[] = [];

    for (const user of sample) {
        const historyData = await redis.lrange(`user:history:${user}`, 0, -1);
        totalAnalyses += historyData.length;

        const history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        const folderIssues = history.filter((a: any) => {
            const hasWarnings = a.warning_flags && a.warning_flags.length > 0;
            const isSuspiciousSymbol = a.symbol.includes(' ') || a.symbol !== a.symbol.toUpperCase();
            const isLowConfidence = a.confidence_score && a.confidence_score < 0.5;
            return hasWarnings || isSuspiciousSymbol || isLowConfidence;
        });

        if (folderIssues.length > 0) {
            issues += folderIssues.length;
            issuesList.push(...folderIssues.map(i => ({...i, user})));
        }
    }

    console.log(`\n📊 Audit Results:`);
    console.log(`   Users Sampled: ${sample.length}`);
    console.log(`   Total Analyses: ${totalAnalyses}`);
    console.log(`   Analyses with Issues: ${issues} (${((issues / totalAnalyses) * 100).toFixed(2)}%)`);

    if (issuesList.length > 0) {
        console.log('\n❌ Sample Issues:');
        issuesList.slice(0, 5).forEach(i => {
            console.log(` - [${i.user}] ${i.symbol}: ${i.confidence_score} (Warnings: ${JSON.stringify(i.warning_flags)})`);
        });
    }

    process.exit(0);
}

auditSample();
