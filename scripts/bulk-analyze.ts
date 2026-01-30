/**
 * Bulk analysis script for processing lists of tweets.
 * Usage: npx tsx scripts/bulk-analyze.ts <INPUT_FILE>
 */

import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// Load env vars BEFORE importing modules that use them
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Import types (safe, erased at runtime)
import type { StoredAnalysis } from '../src/lib/analysis-store';

interface TweetInput {
    id: string;
    username?: string;
    url?: string;
}

interface InputFile {
    calls?: TweetInput[];
}

const WAIT_MS = 2000;

async function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function bulkAnalyze() {
    // Dynamic imports to ensure env vars are loaded first
    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { addAnalysis, updateUserProfile } = await import('../src/lib/analysis-store');
    const { getRedisClient } = await import('../src/lib/redis-client');

    const redis = getRedisClient();
    const inputFile = process.argv[2];

    if (!inputFile) {
        console.error('❌ Usage: npx tsx scripts/bulk-analyze.ts <INPUT_FILE>');
        process.exit(1);
    }

    // 1. Load and Parsing
    console.log(`📂 Loading ${inputFile}...`);
    let rawInput;
    try {
        const fileContent = await fs.readFile(inputFile, 'utf-8');
        rawInput = JSON.parse(fileContent);
    } catch (e: any) {
        console.error(`❌ Failed to read input file: ${e.message}`);
        process.exit(1);
    }

    let explicitTweets: TweetInput[] = [];

    // Option A: Array of strings/objects
    if (Array.isArray(rawInput)) {
        explicitTweets = rawInput.map(item => {
            if (typeof item === 'string') {
                // Extract ID from URL if possible
                const match = item.match(/status\/(\d+)/);
                if (match) return { id: match[1], url: item };
                // Assume it's an ID if no URL structure
                if (/^\d+$/.test(item)) return { id: item };
                return null;
            }
            return item;
        }).filter(Boolean) as TweetInput[];
    }
    // Option B: Object with 'calls' array
    else if (rawInput.calls && Array.isArray(rawInput.calls)) {
        explicitTweets = rawInput.calls;
    } else {
        console.error('❌ Invalid input format. Expected Array or Object with "calls".');
        process.exit(1);
    }

    console.log(`📋 Found ${explicitTweets.length} tweets to process.`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const input of explicitTweets) {
        const { id, username } = input;

        console.log(`\n--------------------------------------------------`);
        console.log(`🔍 Processing Tweet ID: ${id} ${username ? `(@${username})` : ''}`);

        try {
            // 2. Duplicate Check
            // If we know the username, check their specific history
            // If not, we might check a global index if it existed, but we rely on user history for duplicate prevention mostly.
            // However, the requirement says "Skips analyses if the specific tweet ID already exists in that user's history"

            let isDuplicate = false;

            if (username) {
                const historyKey = `user:history:${username.toLowerCase()}`;
                const historyData = await redis.lrange(historyKey, 0, -1);
                // historyData contains strings or objects depending on serialization
                const exists = historyData.some((item: any) => {
                    const parsed = typeof item === 'string' ? JSON.parse(item) : item;
                    return parsed.id === id;
                });

                if (exists) {
                    console.log(`⏭️  Skipping duplicate for @${username}`);
                    isDuplicate = true;
                }
            } else {
                // If no username provided, we can't easily check specific user history without analyzing first to get the author.
                // But we could check global recent list as a heuristic, though not perfect.
                // For now, if no username, we proceed to analyze. The duplicate check might happen AFTER analysis (or we define that input SHOULD have username for correct duplicate checking).
                // Let's rely on the requirement: "Duplicate Check: automatically extracts Tweet ID and Username from input."
                // So if we don't have username, we skip this check and rely on the Analyzer to find it, but we risk double-processing.
                // Optimization: fetch the tweet first? No, analyzeTweet does that.
                // We'll proceed.
            }

            if (isDuplicate) {
                skippedCount++;
                continue;
            }

            // 3. Analyze
            console.log(`🧠 AI Analyzing...`);
            const result = await analyzeTweet(id);

            // Check for duplicates AGAIN using the found username from analysis
            // This covers the case where username wasn't in input but was found in tweet
            const foundUsername = result.tweet.username; // analysis doesn't have username directly usually, tweet does
            const finalUsername = foundUsername;

            if (!username && finalUsername) {
                const historyKey = `user:history:${finalUsername.toLowerCase()}`;
                const historyData = await redis.lrange(historyKey, 0, -1);
                const exists = historyData.some((item: any) => {
                    const parsed = typeof item === 'string' ? JSON.parse(item) : item;
                    return parsed.id === id;
                });

                if (exists) {
                    console.log(`⏭️  Skipping duplicate for @${finalUsername} (detected after fetch)`);
                    skippedCount++;
                    continue;
                }
            }

            // 4. Storage
            // Add to Global Recent Feed
            const analysisToStore: StoredAnalysis = {
                id: result.tweet.id,
                username: finalUsername,
                author: result.tweet.author,
                avatar: result.tweet.avatar,
                symbol: result.analysis.symbol,
                sentiment: result.analysis.sentiment,
                performance: result.market.performance,
                isWin: result.market.performance > 0,
                timestamp: Date.now(),
                entryPrice: result.market.callPrice,
                currentPrice: result.market.currentPrice,
                type: result.analysis.type,
                contractAddress: result.analysis.contractAddress,

                // Context fields
                ticker: result.analysis.ticker,
                action: result.analysis.action,
                confidence_score: result.analysis.confidence_score,
                timeframe: result.analysis.timeframe,
                is_sarcasm: result.analysis.is_sarcasm,
                reasoning: result.analysis.reasoning,
                warning_flags: result.analysis.warning_flags,

                tweetUrl: `https://x.com/${finalUsername}/status/${result.tweet.id}`,
                text: result.tweet.text
            };

            console.log(`💾 Saving analysis for $${analysisToStore.symbol} (${analysisToStore.sentiment})...`);

            await addAnalysis(analysisToStore);
            await updateUserProfile(analysisToStore);

            console.log(`✅ Success! Performance: ${analysisToStore.performance.toFixed(2)}%`);
            processedCount++;

        } catch (e: any) {
            console.error(`❌ Error analyzing tweet ${id}:`, e.message);
            errorCount++;
        }

        // 5. Rate Limit
        await wait(WAIT_MS);
    }

    console.log(`\n🎉 Bulk Analysis Complete!`);
    console.log(`   Processed: ${processedCount}`);
    console.log(`   Skipped:   ${skippedCount}`);
    console.log(`   Errors:    ${errorCount}`);
    console.log(`\n⚠️  Don't forget to flush metrics cache if needed using: npx tsx scripts/clear-metrics-cache.ts`);

    process.exit(0);
}

bulkAnalyze();
