
import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function findFixCandidates() {
    const redis = getRedisClient();

    console.log('🔍 Scanning ALL user histories for candidates...');

    // Get all users
    const users = await redis.smembers('all_users');
    console.log(`Found ${users.length} users.`);

    let candidates: any[] = [];

    for (const user of users) {
        const historyData = await redis.lrange(`user:history:${user}`, 0, -1);
        const history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        const neededFixes = history.filter((a: any) => {
            // Check for specific flags or issues
            const hasWarnings = a.warning_flags && a.warning_flags.length > 0;
            const isManualFix = JSON.stringify(a).includes('Manual Fix Required');
            const isSuspiciousSymbol = a.symbol.includes(' ') || a.symbol !== a.symbol.toUpperCase() || a.symbol.startsWith('$');
            const isLowConfidence = a.confidence_score && a.confidence_score < 0.7; // Lowered threshold to catch more

            return hasWarnings || isManualFix || isSuspiciousSymbol || isLowConfidence;
        });

        if (neededFixes.length > 0) {
            candidates = [...candidates, ...neededFixes];
        }
    }

    console.log(`✅ Found ${candidates.length} candidates across full history.`);

    candidates.forEach((a: any) => {
        console.log(`\n------------------------------------------------`);
        console.log(`ID: ${a.id}`);
        console.log(`User: ${a.username}`);
        console.log(`Symbol: ${a.symbol}`);
        console.log(`Warnings: ${JSON.stringify(a.warning_flags)}`);
        console.log(`Confidence: ${a.confidence_score}`);
    });

    process.exit(0);
}

findFixCandidates();
