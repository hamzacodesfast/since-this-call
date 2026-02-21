#!/usr/bin/env npx tsx
/**
 * @file bulk-analyze.ts
 * @description Script to process multiple tweets from a JSON file.
 * Supports simple array of tweet IDs/URLs or detailed object with 'calls'.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getRedisClient } from '../src/lib/redis-client';

// Load env files
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

function extractTweetId(urlOrId: string): string | null {
    if (!urlOrId) return null;
    const match = urlOrId.match(/(?:status\/|status:)(\d+)/) || urlOrId.match(/^(\d+)$/);
    return match ? match[1] : urlOrId.trim();
}

async function bulkAnalyze() {
    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { updateUserProfile, addAnalysis } = await import('../src/lib/analysis-store');
    const redis = getRedisClient();

    const inputFile = process.argv[2];
    if (!inputFile) {
        console.error('❌ Please provide an input JSON file.');
        process.exit(1);
    }

    let tweetsToProcess: any[] = [];

    try {
        const content = fs.readFileSync(path.resolve(process.cwd(), inputFile), 'utf8');
        const parsed = JSON.parse(content);

        if (Array.isArray(parsed)) {
            tweetsToProcess = parsed.map((item: string) => ({ id: extractTweetId(item) }))
                .filter((t: { id: string | null }) => !!t.id) as { id: string }[];
        } else if (parsed.calls && Array.isArray(parsed.calls)) {
            tweetsToProcess = parsed.calls.map((item: { id?: string, url?: string, username?: string, symbol?: string, action?: 'BUY' | 'SELL' }) => ({
                id: extractTweetId((item.id || item.url) as string),
                username: item.username,
                symbol: item.symbol,
                action: item.action
            })).filter((t: { id: string | null }) => !!t.id) as any[];
        } else {
            throw new Error('Unsupported JSON format.');
        }
    } catch (e: any) {
        console.error('❌ Error reading input file:', e.message);
        process.exit(1);
    }

    console.log(`🚀 Starting bulk analysis of ${tweetsToProcess.length} tweets (Concurrency: 5)...\n`);

    let processedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    const concurrency = 5;
    for (let i = 0; i < tweetsToProcess.length; i += concurrency) {
        const chunk = tweetsToProcess.slice(i, i + concurrency);

        await Promise.all(chunk.map(async (tweetInfo, chunkIdx) => {
            const tweetId = tweetInfo.id;
            const globalIdx = i + chunkIdx + 1;

            try {
                // Check for duplicates
                const recent = await redis.lrange('recent_analyses', 0, -1);
                const isDuplicate = recent.some((a: any) => {
                    const parsed = typeof a === 'string' ? JSON.parse(a) : a;
                    return parsed.id === tweetId;
                });

                if (isDuplicate) {
                    console.log(`[${globalIdx}/${tweetsToProcess.length}] ⏭️ Skipping: Tweet already analyzed.`);
                    skippedCount++;
                    return;
                }

                console.log(`[${globalIdx}/${tweetsToProcess.length}] 🤖 Analyzing tweet ${tweetId}...`);
                const sentimentOverride = tweetInfo.action === 'BUY' ? 'BULLISH' :
                    tweetInfo.action === 'SELL' ? 'BEARISH' : undefined;

                const result = await analyzeTweet(tweetId, undefined, (tweetInfo as any).symbol, sentimentOverride);

                if (!result) {
                    console.log(`[${globalIdx}/${tweetsToProcess.length}] ℹ️  Skipped: No financial call (Noise).`);
                    skippedCount++;
                    return;
                }

                if (!result.analysis.action) {
                    console.log(`[${globalIdx}/${tweetsToProcess.length}] ❌ Failed: Invalid analysis result (No Action)`);
                    failedCount++;
                    return;
                }

                console.log(`[${globalIdx}/${tweetsToProcess.length}] ✅ Extracted: ${result.analysis.action} ${result.analysis.symbol} @ $${result.market.callPrice}`);

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

                await updateUserProfile(storedItem);
                await addAnalysis(storedItem);
                console.log(`[${globalIdx}/${tweetsToProcess.length}] ✅ Saved to @${storedItem.username}.`);
                processedCount++;

            } catch (e: any) {
                console.error(`[${globalIdx}/${tweetsToProcess.length}] ❌ Error processing ${tweetId}:`, e.message);
                failedCount++;
            }
        }));

        if (i + concurrency < tweetsToProcess.length) {
            // console.log('⏳ Waiting 1 second...\n');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    console.log(`\n✨ Bulk Analysis Complete!`);
    console.log(`✅ Processed: ${processedCount}`);
    console.log(`⏭️ Skipped: ${skippedCount}`);
    console.log(`❌ Failed: ${failedCount}`);

    try {
        console.log('\n🔄 Refreshing PRODUCTION metrics first...');
        const { execSync } = await import('child_process');
        // Run refresh-metrics (defaults to production URL)
        execSync('npx tsx scripts/refresh-metrics.ts', { stdio: 'inherit' });

        console.log('\n🔄 Auto-syncing with production...');
        execSync('npx tsx scripts/sync-to-local.ts', { stdio: 'inherit' });

        console.log('\n🔄 Refreshing LOCAL metrics...');
        execSync('npx tsx scripts/refresh-metrics.ts --local', { stdio: 'inherit' });

    } catch (e) {
        console.error('❌ Post-analysis tasks failed:', e);
    }
}

bulkAnalyze();
