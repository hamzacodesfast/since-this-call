import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import { analyzeTweet } from '../src/lib/analyzer';
import { updateUserProfile, addAnalysis } from '../src/lib/analysis-store';

dotenv.config({ path: '.env.local' });

const redis = new Redis({
    url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

// Sleep helper
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function recover(username: string) {
    const lowerUser = username.toLowerCase();

    // 1. Get what's currently there (all available JSON objects)
    const historyKey = `user:history:${lowerUser}`;
    const historyData = await redis.lrange(historyKey, 0, -1);
    const existingIds = new Set(
        historyData.map((item: any) => (typeof item === 'string' ? JSON.parse(item) : item).id)
    );
    console.log(`Current recovered items in profile: ${existingIds.size}`);

    // 2. Get all target IDs from user_index ZSET
    const allRefsString = await redis.zrange(`user_index:${lowerUser}`, 0, -1) as string[];
    const targetIds = allRefsString.map(ref => ref.split(':')[1]);
    console.log(`Expected items from index: ${targetIds.length}`);

    // 3. Find IDs that are missing their JSON payload
    const missingIds = targetIds.filter(id => !existingIds.has(id));
    console.log(`Missing items requiring AI reconstruction: ${missingIds.length}`);

    if (missingIds.length === 0) {
        console.log("Profile is completely intact. Nothing to recover!");
        return;
    }

    console.log("\nStarting AI Recovery Engine...");
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < missingIds.length; i++) {
        const id = missingIds[i];
        console.log(`[${i + 1}/${missingIds.length}] Re-analyzing Tweet ID: ${id}...`);

        try {
            // Push it back through the AI engine
            const result = await analyzeTweet(id);

            if (result.analysis.action) {
                const storedItem = {
                    id: result.tweet.id,
                    username: result.tweet.username,
                    author: result.tweet.author,
                    avatar: result.tweet.avatar,
                    symbol: result.analysis.symbol,
                    sentiment: result.analysis.sentiment,
                    performance: result.market.performance,
                    isWin: result.market.performance > 0,
                    timestamp: new Date(result.tweet.date).getTime(),
                    entryPrice: result.market.callPrice,
                    currentPrice: result.market.currentPrice,
                    type: result.analysis.type,
                    ticker: result.analysis.symbol,
                    action: result.analysis.action,
                    confidence_score: result.analysis.confidence_score,
                    timeframe: result.analysis.timeframe,
                    is_sarcasm: result.analysis.is_sarcasm,
                    reasoning: result.analysis.reasoning,
                    warning_flags: result.analysis.warning_flags,
                    tweetUrl: `https://x.com/${result.tweet.username}/status/${result.tweet.id}`,
                    text: result.tweet.text
                };

                // Note: updateUserProfile will add it to `user:history:{username}`
                await updateUserProfile(storedItem as any);
                await addAnalysis(storedItem as any);
                successCount++;
                console.log(`   ✅ Recovered: ${result.analysis.action} ${result.analysis.symbol}`);
            }
        } catch (e: any) {
            failCount++;
            console.error(`   ❌ Failed to recover ${id}: ${e.message}`);
        }

        // Anti-rate-limit sleep
        await sleep(3500);
    }

    console.log(`\nRecovery Complete!`);
    console.log(`Successfully Reconstructed: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    process.exit(0);
}

const target = process.argv[2];
if (!target) {
    console.log("Please provide a username to recover. Usage: npx tsx scripts/recover-profile-ai.ts theskayeth");
    process.exit(1);
}

recover(target).catch(console.error);
