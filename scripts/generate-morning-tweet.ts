#!/usr/bin/env npx tsx
/**
 * @file generate-morning-tweet.ts
 * @description Generates the data for the "Morning Tweet Blast"
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { getRedisClient } from '../src/lib/redis-client';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const redis = getRedisClient();

async function generateTweet() {
    console.log('🌅 Generating Morning Tweet Blast...\n');

    // 1. Fetch All Profiles
    const allUsers = await redis.smembers('all_users') as string[];
    const pipeline = redis.pipeline();
    allUsers.forEach(u => pipeline.hgetall(`user:profile:${u}`));
    const results = await pipeline.exec();
    console.log('DEBUG: Pipeline Results Sample:', results ? JSON.stringify(results.slice(0, 2)) : 'null');

    const profiles = results?.map((result: any, i) => {
        // Handle result structure differences
        // If result is [err, data], extract data.
        const data = Array.isArray(result) && result.length === 2 && result[0] === null ? result[1] : result;

        return {
            username: allUsers[i],
            ...data
        };
    }) || [];

    // 2. Parse & Rank
    const qualified = profiles
        .map(p => ({
            username: p.username,
            totalAnalyses: parseInt(p.totalAnalyses || '0'),
            winRate: parseFloat(p.winRate || '0'),
            wins: parseInt(p.wins || '0'),
            losses: parseInt(p.losses || '0')
        }))
        .filter(p => p.totalAnalyses >= 7); // Min 7 calls

    // Sort Descending (Top)
    const top5 = [...qualified]
        .sort((a, b) => b.winRate - a.winRate || b.totalAnalyses - a.totalAnalyses)
        .slice(0, 5);

    // Sort Ascending (Bottom)
    const bottom5 = [...qualified]
        .sort((a, b) => a.winRate - b.winRate || b.totalAnalyses - a.totalAnalyses)
        .slice(0, 5);

    // 3. Fetch Platform Metrics (Official source)
    const metricsRaw = await redis.get('platform_metrics');
    const metrics = typeof metricsRaw === 'string' ? JSON.parse(metricsRaw) : metricsRaw;

    if (!metrics) {
        console.error('❌ platform_metrics not found in Redis. Run refresh-metrics.ts first.');
        process.exit(1);
    }

    const { totalAnalyses, winRate, topTickers } = metrics;
    const trending = topTickers.slice(0, 5).map((t: any) => {
        const total = t.bullish + t.bearish;
        const bullRate = total > 0 ? Math.round((t.bullish / total) * 100) : 0;
        const sentimentEmoji = bullRate >= 50 ? '🟢' : '🔴';
        return `$${t.symbol} ${sentimentEmoji} ${bullRate}% Bullish`;
    });

    const spotlightTicker = topTickers[0]?.symbol || null;
    const spotlightStats = topTickers[0] || null;

    // OUTPUT
    console.log(`------------- TWEET DRAFTS -------------`);

    // 1. Trending Tickers Tweet
    console.log(`\n--- 1. Trending Tickers Tweet ---`);
    console.log(`🔥 Sentiment Scan (Last 24h):
`);
    trending.forEach(t => console.log(t));
    console.log(`
Track the narrative 👇
https://sincethiscall.com/recent

#Fintwit #Crypto #Stocks #Sentiment`);

    // 2. Platform Metrics Tweet
    console.log(`\n--- 2. Platform Metrics Tweet ---`);
    console.log(`📊 State of the Market Update

🧾 Total Verified Calls: ${totalAnalyses.toLocaleString()}
🎯 Global Win Rate: ${winRate}%
📉 Active Drawdowns: ${(100 - winRate)}%

Truth is the new asset class.
Verify the database 👇
https://sincethiscall.com/stats

#Data #Fintwit #Trading #Truth`);

    // 3. Top 5 Analysts Tweet
    console.log(`\n--- 3. Top 5 Analysts Tweet ---`);
    console.log(`🏆 The Honor Roll: Top 5 Verified Analysts

${top5.map((p, i) => `${i + 1}. @${p.username} 🎯 ${p.winRate.toFixed(1)}%`).join('\n')}

These accounts are printing alpha. 
See their full records 👇
https://sincethiscall.com/leaderboard

#Fintwit #Crypto #Alpha #Leaderboard`);

    // 4. Bottom 5 Analysts Tweet
    console.log(`\n--- 4. Bottom 5 Analysts Tweet ---`);
    console.log(`💀 The Fade List: Lowest Win Rates (7+ Calls)

${bottom5.map((p, i) => `${i + 1}. @${p.username} ❌ ${p.winRate.toFixed(1)}%`).join('\n')}

Inverse accordingly.
Broadcasting receipts daily 👇
https://sincethiscall.com/leaderboard

#Fintwit #Trading #Inverse #Receipts`);

    // 5. Ticker Spotlight Tweet
    if (spotlightTicker && spotlightStats) {
        const total = spotlightStats.bullish + spotlightStats.bearish;
        const bullRate = total > 0 ? Math.round((spotlightStats.bullish / total) * 100) : 0;
        console.log(`\n--- 5. Ticker Spotlight Tweet ---`);
        console.log(`🎯 Asset Spotlight: $${spotlightTicker}

📊 Activity: ${spotlightStats.callCount} recent calls
🟢 Bullish: ${bullRate}%
🔴 Bearish: ${100 - bullRate}%

See the full sentiment audit for $${spotlightTicker} 👇
https://sincethiscall.com/tickers/${spotlightTicker}

#${spotlightTicker} #SentimentAudit #Fintwit #Trading`);
    }

    console.log(`---------------------------------------`);

    process.exit(0);
}

generateTweet();
