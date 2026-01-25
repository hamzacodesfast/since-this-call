
import * as dotenv from 'dotenv';
import * as path from 'path';

// Fix Prod Data
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function fixIncomeSharks() {
    console.log('🦈 Fixing IncomeSharks Data...');

    // Import after loading env
    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { addAnalysis, getRecentAnalyses } = await import('../src/lib/analysis-store');
    const { getRedisClient } = await import('../src/lib/redis-client');

    const tweetsToFix = [
        '2014461421317456155', // Insider selling vs buying
        '2014459604185579733'  // Eyes on OKLO vs SMR
    ];

    const redis = getRedisClient();
    const username = 'incomesharks';

    // 1. Re-analyze with new logic (SMR should win)
    for (const id of tweetsToFix) {
        console.log(`\nRe-analyzing ${id}...`);
        try {
            const result = await analyzeTweet(id);
            console.log(`Result: ${result.analysis.symbol} (${result.analysis.sentiment})`);

            // 2. Overwrite in DB
            // We need to remove the old one first to avoid dupes? 
            // addAnalysis usually prepends. 
            // Let's manually clean the user's list for these IDs first.

            const historyKey = `user:history:${username}`;
            const history = await redis.lrange(historyKey, 0, -1);

            // Remove old entries with these IDs
            const cleanedHistory = [];
            for (const item of history) {
                const p = typeof item === 'string' ? JSON.parse(item) : item;
                if (!tweetsToFix.includes(p.id)) {
                    cleanedHistory.push(item);
                } else {
                    console.log(`Removing old entry for ${p.id} (${p.symbol})`);
                }
            }

            // Nuke and Replace
            await redis.del(historyKey);
            if (cleanedHistory.length > 0) {
                await redis.rpush(historyKey, ...cleanedHistory);
            }

            // Add new Good Analysis
            // We construct the StoredAnalysis object
            const analysis = {
                id: result.tweet.id,
                username: result.tweet.username,
                author: result.tweet.author,
                avatar: result.tweet.avatar,
                symbol: result.analysis.symbol,
                sentiment: result.analysis.sentiment,
                performance: result.market.performance,
                isWin: result.market.performance > 0, // Simplified for now
                entryPrice: result.market.callPrice,
                currentPrice: result.market.currentPrice,
                type: result.analysis.type,
                contractAddress: result.analysis.contractAddress,
                timestamp: new Date(result.tweet.date).getTime()
            };

            // Add to Global Recent & User History
            // Note: addAnalysis adds to recent list too.
            // We might want to be careful not to spam global list, but it's fine for 2 tweets.
            await addAnalysis(analysis);
            console.log(`Saved new analysis for ${id}`);

        } catch (e) {
            console.error(`Failed to fix ${id}:`, e);
        }
    }

    // 3. Recalculate Profile Stats in background handled by addAnalysis usually? 
    // No, addAnalysis calls updateUserProfile.

    console.log('Done.');
    process.exit(0);
}

fixIncomeSharks();
