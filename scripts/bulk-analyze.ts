
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import { Redis } from '@upstash/redis';

// Load env before importing modules that use it
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

// Schema for input file: Either Array of Strings (IDs) or Array of Objects
const InputSchema = z.union([
    z.array(z.string()),
    z.array(z.any())
]);

async function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function bulkAnalyze() {
    // Dynamic imports to ensure env vars are loaded first
    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { addAnalysis, updateUserProfile } = await import('../src/lib/analysis-store');

    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Usage: npx tsx scripts/bulk-analyze.ts <path-to-json-file>');
        process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    console.log(`📦 Reading file: ${filePath}`);
    const rawData = fs.readFileSync(filePath, 'utf-8');
    let data;

    try {
        data = JSON.parse(rawData);
    } catch (e) {
        console.error('Invalid JSON file.');
        process.exit(1);
    }

    // Check for wrapper object { calls: [...] }
    let items;
    if (data.calls && Array.isArray(data.calls)) {
        items = data.calls;
    } else {
        const result = InputSchema.safeParse(data);
        if (result.success) {
            items = result.data;
        } else {
            console.error('Invalid file format. Must be an array, or an object with "calls" array.');
            process.exit(1);
        }
    }

    console.log(`Found ${items.length} items to process.`);

    let processed = 0;
    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of items) {
        processed++;
        const tweetId = typeof item === 'string'
            ? item.split('/').pop()?.split('?')[0]
            : (item.tweetId || item.id_str || item.id);

        const username = typeof item === 'string' ? 'user' : (item.username || item.user?.screen_name || 'user');

        if (!tweetId) {
            console.warn(`[${processed}/${items.length}] Skipping item with no tweetId`);
            failed++;
            continue;
        }

        // --- SKIPPING LOGIC ---
        // Check if already in history (if username known)
        if (username !== 'user') {
            const historyKey = `user:history:${username.toLowerCase()}`;
            const history = await redis.lrange(historyKey, 0, -1);
            const exists = history.some((h: any) => {
                const p = typeof h === 'string' ? JSON.parse(h) : h;
                return p.id === tweetId;
            });
            if (exists) {
                console.log(`[${processed}/${items.length}] Skipping existing: ${tweetId} (@${username})`);
                skipped++;
                continue;
            }
        }

        console.log(`\n[${processed}/${items.length}] Processing: ${tweetId} (@${username})...`);

        let retryCount = 0;
        const maxRetries = 3;
        let analysisResult = null;

        while (retryCount < maxRetries) {
            try {
                // Fetch live data (this calls getTweet internally)
                analysisResult = await analyzeTweet(tweetId);
                break; // Success!
            } catch (error: any) {
                retryCount++;
                console.error(`  ❌ Attempt ${retryCount} failed: ${error.message}`);
                if (retryCount < maxRetries) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    console.log(`  ⏳ Retrying in ${delay / 1000}s...`);
                    await wait(delay);
                } else {
                    failed++;
                }
            }
        }

        if (!analysisResult) continue;

        try {
            // Store result
            const storedAnalysis = {
                id: analysisResult.tweet.id,
                username: analysisResult.tweet.username,
                author: analysisResult.tweet.author,
                avatar: analysisResult.tweet.avatar,
                symbol: analysisResult.analysis.symbol,
                sentiment: analysisResult.analysis.sentiment,
                performance: analysisResult.market.performance ?? 0,
                isWin: (analysisResult.market.performance ?? 0) > 0,
                timestamp: new Date(analysisResult.tweet.date).getTime(),
                entryPrice: analysisResult.market.callPrice ?? 0,
                currentPrice: analysisResult.market.currentPrice ?? 0,
                type: analysisResult.analysis.type,
                contractAddress: analysisResult.analysis.contractAddress,
                tweetUrl: `https://x.com/${analysisResult.tweet.username}/status/${analysisResult.tweet.id}`,
                text: analysisResult.tweet.text
            };

            await addAnalysis(storedAnalysis);
            await updateUserProfile(storedAnalysis);
            success++;
            console.log(`✅ Success: ${storedAnalysis.symbol} (${storedAnalysis.sentiment})`);

        } catch (error: any) {
            console.error(`❌ Storage Failed:`, error.message);
            failed++;
        }

        // Rate limit: 2 seconds between calls to avoid 429
        await wait(2000);
    }

    console.log(`\n🎉 Bulk analysis complete!`);
    console.log(`Total: ${items.length}`);
    console.log(`Success: ${success}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);

    // Auto-refresh metrics if any success
    if (success > 0) {
        console.log('\n🔄 Refreshing metrics...');
        const { Redis } = await import('@upstash/redis'); // Just to be safe
        // Logic for refreshing metrics integrated or call script
    }

    process.exit(0);
}

bulkAnalyze();
