
import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

/**
 * Regex for identifying crude oil related tweets.
 * Includes common terms, locations (Hormuz), and slang.
 */
const OIL_REGEX = /\b(oil|crude|wti|brent|strait|hormuz|barrel|cl=f|petroleum|energy|spr|black gold|shale|gasoline|refinery|refiners)\b/i;

async function consolidateOil() {
    const { recalculateUserProfile, trackTicker, untrackTicker, updateTickerStats, dualWrite } = await import('../src/lib/analysis-store');
    const redis = getRedisClient();

    console.log('🔍 Starting Heavy Consolidation of Oil Analysis...');
    console.log('--- Moving matching "CL" -> "CL=F" ---');

    // 1. Get all CL analyses from the index
    const count = await redis.zcard('ticker_index:STOCK:CL');
    console.log(`zcard('ticker_index:STOCK:CL') = ${count}`);

    const clRefs = await redis.zrange('ticker_index:STOCK:CL', 0, -1);
    console.log(`zrange('ticker_index:STOCK:CL', 0, -1) count = ${clRefs.length}`);

    if (clRefs.length === 0 && count > 0) {
        console.warn('⚠️ Discrepancy detected! zcard > 0 but zrange returned 0.');
    }

    let movedCount = 0;
    let skippedCount = 0;

    // Group by user to minimize fetches
    const userMap = new Map<string, string[]>();
    for (const ref of clRefs) {
        const [username, id] = (ref as string).split(':');
        if (!userMap.has(username)) userMap.set(username, []);
        userMap.get(username)!.push(id);
    }

    const usernames = Array.from(userMap.keys());
    for (const user of usernames) {
        const historyKey = `user:history:${user}`;
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history: any[] = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        const targetIds = new Set(userMap.get(user));
        let userUpdated = false;

        for (let i = 0; i < history.length; i++) {
            const analysis = history[i];
            if (!targetIds.has(analysis.id)) continue;

            const text = analysis.text || '';
            const reasoning = analysis.reasoning || '';
            const isOil = OIL_REGEX.test(text) || OIL_REGEX.test(reasoning);

            if (isOil) {
                console.log(`\n📦 MATCH: ${analysis.id} (@${user})`);
                console.log(`   Text: "${text.substring(0, 100)}..."`);
                
                const oldAnalysis = { ...analysis };
                
                // Update to CL=F
                analysis.symbol = 'CL=F';
                analysis.ticker = 'CL=F';
                analysis.type = 'STOCK';
                
                // Also some records might have 'type' missing
                if (!oldAnalysis.type) oldAnalysis.type = 'STOCK';

                // 2. Untrack from CL
                await untrackTicker(oldAnalysis);
                // 3. Track to CL=F
                await trackTicker(analysis);
                // 4. Update stats (Decrement CL, Increment CL=F)
                await updateTickerStats(analysis, false, oldAnalysis);

                userUpdated = true;
                movedCount++;
            } else {
                skippedCount++;
            }
        }

        if (userUpdated) {
            // Write back user history
            await dualWrite(async (r) => {
                await r.del(historyKey);
                const pipe = r.pipeline();
                for (let i = history.length - 1; i >= 0; i--) {
                    pipe.lpush(historyKey, JSON.stringify(history[i]));
                }
                await pipe.exec();
            });
            
            // Recalculate user profile just in case (though ticker stats handled above)
            await recalculateUserProfile(user);
            console.log(`   ✅ Updated @${user} history and profile.`);
        }
    }

    console.log('\n--- Final Stats ---');
    console.log(`Moved: ${movedCount}`);
    console.log(`Skipped: ${skippedCount} (Likely genuine Colgate)`);
    
    // Final Ticker Profile update for both
    console.log('\n🔄 Refreshing Ticker Profiles for CL and CL=F...');
    const { updateTickerProfile } = await import('../src/lib/analysis-store');
    await updateTickerProfile('STOCK:CL');
    await updateTickerProfile('STOCK:CL=F');

    console.log('✨ Consolidation complete.');
    process.exit(0);
}

consolidateOil();
