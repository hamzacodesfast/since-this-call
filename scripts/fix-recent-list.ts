
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Env (TARGET PRODUCTION)
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

if (!process.env.UPSTASH_REDIS_REST_KV_REST_API_URL) {
    console.warn('⚠️ Key missing, falling back to local...');
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}

async function fixRecentList() {
    console.log('🔄 Syncing corrected User History to Recent Analyses...');

    // Dynamic import
    const { getRedisClient } = await import('../src/lib/redis-client');
    const redis = getRedisClient();

    // 1. Fetch Recent List
    const recentRaw = await redis.lrange('recent_analyses', 0, -1);
    const recent = recentRaw.map((s: any) => typeof s === 'string' ? JSON.parse(s) : s);

    console.log(`Found ${recent.length} recent analyses.`);

    let updates = 0;
    const newRecent = [];

    // 2. Iterate and check for "Bad" prices on Known Stocks
    // Simple heuristic: If MSTR/AAPL/COIN < $5.00, it's wrong.
    const KNOWN_STOCKS = ['MSTR', 'AAPL', 'COIN', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOG'];

    for (const item of recent) {
        let finalItem = item;

        if (KNOWN_STOCKS.includes(item.symbol.toUpperCase()) && item.currentPrice < 5) {
            console.log(`⚠️ Found suspicious entry: ${item.symbol} @ $${item.currentPrice} (ID: ${item.id})`);

            // Fetch from User History (which we know is corrected)
            const historyKey = `user:history:${item.username.toLowerCase()}`;
            const history = await redis.lrange(historyKey, 0, -1);
            const userHistory = history.map((s: any) => typeof s === 'string' ? JSON.parse(s) : s);

            const corrected = userHistory.find((h: any) => h.id === item.id);

            if (corrected && corrected.currentPrice > 5) {
                console.log(`   ✅ Found corrected version in history: $${corrected.currentPrice}`);
                finalItem = corrected;
                updates++;
            } else {
                console.log(`   ❌ Could not find better version in user history.`);
            }
        }

        newRecent.push(finalItem);
    }

    if (updates > 0) {
        console.log(`\n💾 Saving ${updates} corrections to recent_analyses...`);

        // Atomic replace might be tricky with just lrange/del, but good enough for this cleanup
        await redis.del('recent_analyses');

        // Push in reverse order (oldest first) so rpush builds list correctly? 
        // No, we iterated 0..-1 (newest first usually).
        // recent_analyses is usually LPUSH'd (Newest at 0).
        // So we should RPUSH newRecent (which is 0..-1) from left to right?
        // Wait. lrange 0 -1 returns [Newest, ..., Oldest].
        // If we iterate array [Newest, ..., Oldest], we should RPUSH them to recreate?
        // No. If we RPUSH [Newest], list becomes [Newest]. Then RPUSH [Next] -> [Newest, Next].
        // Yes.

        const pipeline = redis.pipeline();
        for (const item of newRecent) {
            pipeline.rpush('recent_analyses', JSON.stringify(item));
        }
        await pipeline.exec();

        console.log('✅ Update Complete.');
    } else {
        console.log('✨ No bad entries found or no corrections available.');
    }

    process.exit(0);
}

fixRecentList();
