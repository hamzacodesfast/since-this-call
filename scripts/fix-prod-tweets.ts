
import { Redis } from '@upstash/redis';

// Explicitly define Production Credentials
const PROD_URL = "https://moved-fox-21819.upstash.io";
const PROD_TOKEN = "AVU7AAIncDI5OTczMmI0NWQ3NjE0NTRiOWY2NTAzZmUyMjFiOGU0ZHAyMjE4MTk";

const redis = new Redis({
    url: PROD_URL,
    token: PROD_TOKEN,
});

async function fixProdTweets() {
    console.log('🔧 FIXING PROD TWEETS...');
    const USERNAME = 'mr_derivatives'; // Assuming lowercase
    const HISTORY_KEY = `user:history:${USERNAME}`;

    // Fetch History
    const historyData = await redis.lrange(HISTORY_KEY, 0, -1);
    const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);

    console.log(`Found ${history.length} items for ${USERNAME}`);

    let modified = false;
    const newHistory = [];

    for (const item of history) {
        // TWEET 1: FIX SENTIMENT (Bearish GOOG)
        if (item.id === '2017615267355074695') {
            console.log(`   📝 Updating 2017615267355074695 to BEARISH GOOG...`);
            item.sentiment = 'BEARISH';
            item.symbol = 'GOOG'; // Ensure symbol is GOOG
            item.type = 'STOCK';
            // Flip performance sign if it was calculated as Bullish
            // Or just reset it? Let's just flip sign if it exists
            if (item.performance) {
                // If it was bullish, perf = (curr - entry)/entry
                // If bearish, perf = -(curr - entry)/entry
                // So if we switch to bearish, just negate the previous perf (assuming entry/curr hasn't changed)
                // Actually, let's recalculate if we can, but negation is safer if we don't have live prices here.
                // Wait, if existing perf was based on Bullish, and price went DOWN, perf is negative.
                // If we switch to Bearish, and price went DOWN, perf should be positive.
                // So yes, negating works.
                item.performance = -item.performance;
                item.isWin = item.performance > 0;
            }
            modified = true;
            newHistory.push(item);
        }
        // TWEET 2: REMOVE (No context)
        else if (item.id === '2017044134335594734') {
            console.log(`   ❌ Removing 2017044134335594734 (Contextless)...`);
            modified = true;
            // Do not push to newHistory

            // Should also remove from global index?
            // "global:analyses:timestamp" -> member is "username:id"
            await redis.zrem('global:analyses:timestamp', `${USERNAME}:${item.id}`);
        }
        else {
            newHistory.push(item);
        }
    }

    if (modified) {
        console.log(`Saving updated history for ${USERNAME}...`);
        await redis.del(HISTORY_KEY);

        if (newHistory.length > 0) {
            const p = redis.pipeline();
            // Preserve order (assuming input was newest to oldest, we push reversed)
            for (let i = newHistory.length - 1; i >= 0; i--) {
                p.lpush(HISTORY_KEY, JSON.stringify(newHistory[i]));
            }
            await p.exec();
        }

        // Recalc Profile
        console.log('Recalculating profile...');
        const len = newHistory.length;
        let wins = 0;
        let losses = 0;
        let neutral = 0;
        for (const i of newHistory) {
            if (Math.abs(i.performance) < 0.01) neutral++;
            else if (i.isWin) wins++;
            else losses++;
        }
        const winRate = len > 0 ? (wins / len) * 100 : 0;

        await redis.hset(`user:profile:${USERNAME}`, {
            totalAnalyses: len,
            wins,
            losses,
            neutral,
            winRate,
            lastAnalyzed: Date.now()
        });

        // Clear Cache
        console.log('Clearing global metrics cache...');
        await redis.del('platform_metrics');

        console.log('✅ Fixes applied successfully.');
    } else {
        console.log('⚠️ No matching tweets found to fix.');
    }

    process.exit(0);
}

fixProdTweets().catch(console.error);
