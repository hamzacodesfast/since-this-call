
import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars - PRODUCTION MUST WIN
dotenv.config({ path: path.resolve(process.cwd(), '.env.production'), override: true });
dotenv.config({ override: true });

const OIL_REGEX = /\b(oil|crude|wti|brent|strait|hormuz|barrel|cl=f|petroleum|energy|spr|black gold|shale|gasoline|refinery|refiners)\b/i;

async function consolidateOilProd() {
    const { recalculateUserProfile, trackTicker, untrackTicker, updateTickerStats, dualWrite } = await import('../src/lib/analysis-store');
    const redis = getRedisClient();

    console.log('🔌 Connected to Redis:', process.env.UPSTASH_REDIS_REST_URL);
    console.log('🚀 Starting PROD FULL SCAN Consolidation...');

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
            if (analysis.symbol === 'CL=F') continue;

            const text = (analysis.text || '').toLowerCase();
            const reasoning = (analysis.reasoning || '').toLowerCase();
            const isAmbiguousTicker = ['CL', 'OIL', 'CRUDE', 'WTI', 'BRENT', 'CL_F'].includes(analysis.symbol.toUpperCase());
            const hasOilTerms = OIL_REGEX.test(text) || OIL_REGEX.test(reasoning);

            if (isAmbiguousTicker && hasOilTerms) {
                if (text.includes('toothpaste') || text.includes('not crude')) continue;

                console.log(`📦 MATCH: ${analysis.id} (@${user}) - Moving ${analysis.symbol} -> CL=F`);

                const oldAnalysis = { ...analysis };
                if (!oldAnalysis.type) oldAnalysis.type = 'STOCK';

                analysis.symbol = 'CL=F';
                analysis.ticker = 'CL=F';
                analysis.type = 'STOCK';

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

    console.log(`\n✅ Finished! Consolidated ${totalMoved} analyses into CL=F on Production.`);

    const { updateTickerProfile } = await import('../src/lib/analysis-store');
    await updateTickerProfile('STOCK:CL');
    await updateTickerProfile('STOCK:CL=F');

    process.exit(0);
}

consolidateOilProd();
