
import * as dotenv from 'dotenv';
import path from 'path';

// Load Env (Priority: Production -> Local)
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
    const { getRedisClient } = await import('../src/lib/redis-client');
    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { recalculateUserProfile, trackTicker, untrackTicker } = await import('../src/lib/analysis-store');

    const redis = getRedisClient();

    console.log('🔍 Searching for all users to repair history timestamps...');
    const users = await redis.smembers('all_users');

    console.log(`Found ${users.length} total users. Repairing ALL users.`);
    const topUsers = users; // Process everyone

    for (const username of topUsers) {
        const historyKey = `user:history:${username.toLowerCase()}`;
        const historyData = await redis.lrange(historyKey, 0, -1);

        const history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        let hasChanges = false;
        const updatedHistory = [];

        console.log(`\n👤 Processing @${username} (${history.length} calls)...`);

        for (const oldAnalysis of history) {
            // Check if timestamp looks like an "analysis time" (recent) vs "tweet time" (older)
            // Or just re-analyze if we are unsure.
            // For now, let's re-analyze EVERYTHING to be absolutely sure we have historical parity.

            console.log(`  🔄 Repairing ${oldAnalysis.id} (${oldAnalysis.symbol})...`);

            try {
                const { getTweet } = await import('react-tweet/api');
                const { getPrice, calculatePerformance } = await import('../src/lib/market-data');

                const tweet = await getTweet(oldAnalysis.id);
                if (!tweet) throw new Error('Tweet not found');

                const timestamp = new Date(tweet.created_at).getTime();
                const entryPrice = await getPrice(oldAnalysis.symbol, oldAnalysis.type || 'CRYPTO', new Date(timestamp));

                if (entryPrice === null) throw new Error('Price data found as null');

                const currentPrice = await getPrice(oldAnalysis.symbol, oldAnalysis.type || 'CRYPTO');
                if (currentPrice === null) throw new Error('Current price found as null');

                const performance = calculatePerformance(entryPrice, currentPrice, oldAnalysis.sentiment);

                const newAnalysis = {
                    ...oldAnalysis,
                    timestamp,
                    entryPrice,
                    currentPrice,
                    performance,
                    isWin: performance > 0,
                };

                updatedHistory.push(newAnalysis);

                if (newAnalysis.timestamp !== oldAnalysis.timestamp || newAnalysis.entryPrice !== oldAnalysis.entryPrice) {
                    hasChanges = true;
                    console.log(`    ✅ Fixed! Timestamp: ${oldAnalysis.timestamp} -> ${newAnalysis.timestamp} | Price: ${oldAnalysis.entryPrice} -> ${newAnalysis.entryPrice}`);
                }

                // Update ticker tracking
                await untrackTicker(oldAnalysis);
                await trackTicker(newAnalysis);

            } catch (e: any) {
                console.error(`    ❌ Failed: ${e.message}`);
                updatedHistory.push(oldAnalysis); // Keep old if failed
            }

            // Rate limit delay (Gemini free tier has 10 RPM)
            await new Promise(r => setTimeout(r, 6500));
        }

        if (hasChanges) {
            console.log(`  💾 Saving updated history for @${username}...`);
            await redis.del(historyKey);
            for (let i = updatedHistory.length - 1; i >= 0; i--) {
                await redis.lpush(historyKey, JSON.stringify(updatedHistory[i]));
            }
            await recalculateUserProfile(username);
        } else {
            console.log(`  (No changes needed for @${username})`);
        }
    }

    console.log('\n🌌 Repairing recent_analyses list...');
    const recentData = await redis.lrange('recent_analyses', 0, -1);
    const recent = recentData.map((item: any) =>
        typeof item === 'string' ? JSON.parse(item) : item
    );

    const updatedRecent = [];
    for (const old of recent) {
        try {
            console.log(`  🔄 Repairing recent: ${old.id} (${old.symbol})...`);
            const { getTweet } = await import('react-tweet/api');
            const { getPrice, calculatePerformance } = await import('../src/lib/market-data');

            const tweet = await getTweet(old.id);
            if (!tweet) throw new Error('Tweet not found');

            const timestamp = new Date(tweet.created_at).getTime();
            const entryPrice = await getPrice(old.symbol, old.type || 'CRYPTO', new Date(timestamp));
            if (entryPrice === null) throw new Error('Price data found as null');

            const currentPrice = await getPrice(old.symbol, old.type || 'CRYPTO');
            if (currentPrice === null) throw new Error('Current price found as null');

            const performance = calculatePerformance(entryPrice, currentPrice, old.sentiment);

            updatedRecent.push({
                ...old,
                timestamp,
                entryPrice,
                currentPrice,
                performance,
                isWin: performance > 0
            });
            await new Promise(r => setTimeout(r, 200));
        } catch {
            updatedRecent.push(old);
        }
    }

    await redis.del('recent_analyses');
    for (let i = updatedRecent.length - 1; i >= 0; i--) {
        await redis.lpush('recent_analyses', JSON.stringify(updatedRecent[i]));
    }

    console.log('\n✅ System-wide repair complete!');
    process.exit(0);
}

main();
