
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Redis } from '@upstash/redis';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function removeProduction() {
    const tweetIds = process.argv.slice(2);

    if (tweetIds.length === 0) {
        console.error('❌ Usage: npx tsx scripts/remove-production.ts <TWEET_ID_1> <TWEET_ID_2> ...');
        process.exit(1);
    }

    const prodUrl = process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL;
    const prodToken = process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

    if (!prodUrl || !prodToken) {
        console.error('❌ Production Redis credentials missing in .env.local');
        process.exit(1);
    }

    const redis = new Redis({ url: prodUrl, token: prodToken });
    const RECENT_KEY = 'recent_analyses';
    const ALL_USERS_KEY = 'all_users';

    console.log(`🌐 TARGET: Production (${prodUrl})`);

    for (const tweetId of tweetIds) {
        console.log(`\n🗑️ Removing Tweet ${tweetId}...`);

        // 1. Remove from Global Recent List
        const analyses = await redis.lrange(RECENT_KEY, 0, -1);
        const filteredRecent = analyses.filter((item: any) => {
            const p = typeof item === 'string' ? JSON.parse(item) : item;
            return p.id !== tweetId;
        });

        if (filteredRecent.length < analyses.length) {
            await redis.del(RECENT_KEY);
            for (let i = filteredRecent.length - 1; i >= 0; i--) {
                await redis.lpush(RECENT_KEY, JSON.stringify(filteredRecent[i]));
            }
            console.log(` ✅ Removed from Global Recent list.`);
        }

        // 2. Scan All User Histories
        const users = await redis.smembers(ALL_USERS_KEY);
        for (const user of users) {
            const historyKey = `user:history:${user}`;
            const history = await redis.lrange(historyKey, 0, -1);
            const filteredHistory = history.filter((item: any) => {
                const p = typeof item === 'string' ? JSON.parse(item) : item;
                return p.id !== tweetId;
            });

            if (filteredHistory.length < history.length) {
                await redis.del(historyKey);
                for (let i = filteredHistory.length - 1; i >= 0; i--) {
                    await redis.lpush(historyKey, JSON.stringify(filteredHistory[i]));
                }
                console.log(` ✅ Removed from @${user}'s history.`);

                // Trigger Recalculation (Minimal Re-implementation for Prod script)
                console.log(` 📊 Recalculating stats for @${user}...`);
                const updatedHistory = filteredHistory.map(item => typeof item === 'string' ? JSON.parse(item) : item);
                let wins = 0, losses = 0, neutral = 0;
                for (const item of updatedHistory) {
                    if (Math.abs(item.performance) < 0.01) neutral++;
                    else if (item.isWin) wins++;
                    else losses++;
                }
                const winRate = updatedHistory.length > 0 ? (wins / updatedHistory.length) * 100 : 0;
                const profileKey = `user:profile:${user}`;
                await redis.hset(profileKey, {
                    wins,
                    losses,
                    neutral,
                    winRate,
                    totalAnalyses: updatedHistory.length,
                    lastAnalyzed: Date.now()
                });
            }
        }

        // 3. Remove from Ticker Index
        // This is a bit more complex since we don't have the symbol easily here without the analysis object
        // But the price update script will eventually clean up stales. 
        // For a perfect cleanup we should scan ticker_index:* but that's expensive.
    }

    console.log('\n✨ Production cleanup complete.');
    process.exit(0);
}

removeProduction();
