
import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars - LOCAL SHOULD WIN for this test, or we explicitly target prod.
// Let's load .env last or use override.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ override: true });

const OIL_REGEX = /\b(oil|crude|wti|brent|strait|hormuz|barrel|cl=f|petroleum|energy|spr|black gold|shale|gasoline|refinery|refiners)\b/i;

async function consolidateOilFullScan() {
    const { recalculateUserProfile, trackTicker, untrackTicker, updateTickerStats, dualWrite } = await import('../src/lib/analysis-store');
    const redis = getRedisClient();

    console.log('🔌 Connected to Redis:', process.env.UPSTASH_REDIS_REST_URL || 'Local');
    console.log('🚀 Starting FULL SCAN Consolidation (All Users)...');

    const users = await redis.smembers('all_users');
    console.log(`Scanning history for ${users.length} users...`);

    let totalMoved = 0;

    for (const user of users) {
        const historyKey = `user:history:${user}`;
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history: any[] = historyData.map((item: any) =>
            (typeof item === 'string' ? JSON.parse(item) : item)
        );

        let userUpdated = false;

        for (let i = 0; i < history.length; i++) {
            const analysis = history[i];
            
            // Check if it's already CL=F
            if (analysis.symbol === 'CL=F') continue;

            const text = analysis.text || '';
            const reasoning = analysis.reasoning || '';
            
            // If it's CL or OIL or CRUDE or similar, and matches the regex
            const isAmbiguousTicker = ['CL', 'OIL', 'CRUDE', 'WTI', 'BRENT', 'CL_F'].includes(analysis.symbol.toUpperCase());
            const hasOilTerms = OIL_REGEX.test(text) || OIL_REGEX.test(reasoning);

            if (isAmbiguousTicker && hasOilTerms) {
                // EXCEPTION: Check for "toothpaste" or "lsdinmycoffee" joke
                if (text.toLowerCase().includes('toothpaste') || text.toLowerCase().includes('not crude')) {
                    continue;
                }

                console.log(`📦 MATCH: ${analysis.id} (@${user})`);
                console.log(`   Old Symbol: ${analysis.symbol}`);
                console.log(`   Text: "${text.substring(0, 80)}..."`);

                const oldAnalysis = { ...analysis };
                if (!oldAnalysis.type) oldAnalysis.type = 'STOCK'; // Default to stock for untracking

                // Update to CL=F
                analysis.symbol = 'CL=F';
                analysis.ticker = 'CL=F';
                analysis.type = 'STOCK';

                // Untrack old, track new, update stats
                await untrackTicker(oldAnalysis);
                await trackTicker(analysis);
                await updateTickerStats(analysis, false, oldAnalysis);

                userUpdated = true;
                totalMoved++;
            }
        }

        if (userUpdated) {
            await dualWrite(async (r) => {
                await r.del(historyKey);
                const pipe = r.pipeline();
                for (let i = history.length - 1; i >= 0; i--) {
                    pipe.lpush(historyKey, JSON.stringify(history[i]));
                }
                await pipe.exec();
            });
            await recalculateUserProfile(user);
        }
    }

    console.log(`\n✅ Finished! Consolidated ${totalMoved} analyses into CL=F.`);

    // Final Ticker Refresh
    const { updateTickerProfile } = await import('../src/lib/analysis-store');
    await updateTickerProfile('STOCK:CL');
    await updateTickerProfile('STOCK:CL=F');

    process.exit(0);
}

consolidateOilFullScan();
