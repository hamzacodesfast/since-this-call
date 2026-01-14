
import * as dotenv from 'dotenv';
import path from 'path';
import { Redis } from '@upstash/redis';

// Load Env FIRST
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

// Verify Env
if (!process.env.UPSTASH_REDIS_REST_KV_REST_API_URL) {
    console.error('❌ UPSTASH_REDIS_REST_KV_REST_API_URL is missing!');
    process.exit(1);
}

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const RECENT_ANALYSES_KEY = 'recent_analyses';

async function main() {
    console.log('🔄 Starting Full Re-Analysis (Safe Mode)...');

    // Dynamic Import of App Logic (Ensures Env is ready)
    const { analyzeTweet } = await import('../src/lib/analyzer');
    // We don't import StoredAnalysisSchema here to avoid more deps, we can just define shape or trust output?
    // Better to safeParse.
    const { StoredAnalysisSchema } = await import('../src/lib/analysis-store');

    // 1. Recover IDs from User Histories
    console.log('Recovering Tweet IDs from User Histories...');
    const users = await redis.smembers('all_users');
    const uniqueIds = new Set<string>();
    const uniqueItems: any[] = [];

    for (const user of users) {
        const history = await redis.lrange(`user:history:${user}`, 0, -1);
        for (const raw of history) {
            const item = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!uniqueIds.has(item.id)) {
                uniqueIds.add(item.id);
                uniqueItems.push(item);
            }
        }
    }

    // Sort Oldest -> Newest
    uniqueItems.sort((a, b) => a.timestamp - b.timestamp);
    const existingAnalyses = uniqueItems; // Process ALL

    console.log(`Found ${existingAnalyses.length} unique tweets to re-analyze from ${users.length} users.`);

    if (existingAnalyses.length === 0) {
        console.warn('⚠️ No tweets found. Check redis or keys.');
        // Don't clear list if we found nothing, safe escape.
        process.exit(0);
    }

    // 2. Clear current list (Fresh Start)
    await redis.del(RECENT_ANALYSES_KEY);
    console.log('🗑️  Cleared recent_analyses list.');

    // 3. Re-process each tweet
    let successCount = 0;

    for (let i = 0; i < existingAnalyses.length; i++) {
        const oldItem = existingAnalyses[i];
        console.log(`\nProcessing ${i + 1}/${existingAnalyses.length}: ${oldItem.id} (${oldItem.symbol})...`);

        try {
            const result = await analyzeTweet(oldItem.id);

            if (!result || !result.tweet) {
                console.error(`❌ Analysis failed for ${oldItem.id}`);
                continue;
            }

            const { analysis, market, tweet } = result;

            if (!tweet.user) {
                console.error(`❌ Tweet user data missing for ${oldItem.id}`);
                continue;
            }

            const storedAnalysis = {
                id: tweet.id_str,
                username: tweet.user.screen_name,
                author: tweet.user.name,
                avatar: tweet.user.profile_image_url_https,
                symbol: analysis.symbol,
                sentiment: analysis.sentiment,
                performance: market.performance,
                isWin: market.performance > 0,
                timestamp: new Date(tweet.created_at).getTime(),
                entryPrice: market.callPrice,
                currentPrice: market.currentPrice,
                type: analysis.type,
            };

            const parsed = StoredAnalysisSchema.safeParse(storedAnalysis);
            if (!parsed.success) {
                console.error(`❌ Validation failed for ${oldItem.id}:`, parsed.error);
                continue;
            }

            // Add to Redis
            const len = await redis.lpush(RECENT_ANALYSES_KEY, JSON.stringify(parsed.data));
            console.log(`✅ Saved: ${analysis.symbol} | List Len: ${len}`);
            successCount++;

            // Rate Limit Delay
            console.log('⏳ Cooling down (6s)...');
            await new Promise(r => setTimeout(r, 6000));

        } catch (e: any) {
            console.error(`❌ Error processing ${oldItem.id}:`, e.message);
        }
    }

    console.log(`\n🏁 Re-analysis Complete. Success: ${successCount}`);
    process.exit(0);
}

main();
