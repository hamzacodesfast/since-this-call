
import * as dotenv from 'dotenv';
import path from 'path';

// Load Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const { getRedisClient } = await import('../src/lib/redis-client');
    const redis = getRedisClient();

    // Dynamic import to avoid env issues
    const { reanalyzeTweetById } = await import('./repair-helper');

    const username = 'GarrettBullish';
    const historyKey = `user:history:${username.toLowerCase()}`;

    console.log(`🛠️ Fixing history for @${username}...`);

    const historyData = await redis.lrange(historyKey, 0, -1);
    const ids = historyData.map((item: any) => {
        const p = typeof item === 'string' ? JSON.parse(item) : item;
        return p.id;
    });

    console.log(`Found ${ids.length} tweets to re-analyze.`);

    for (let i = 0; i < ids.length; i++) {
        console.log(`\n[${i + 1}/${ids.length}] Re-analyzing ${ids[i]}...`);
        try {
            await reanalyzeTweetById(ids[i]);
            // Wait to avoid rate limits
            await new Promise(r => setTimeout(r, 2000));
        } catch (e: any) {
            console.error(`  ❌ Failed ${ids[i]}: ${e.message}`);
        }
    }

    console.log('\n✅ Repair complete for GarrettBullish!');
    process.exit(0);
}

main();
