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
        .filter(p => p.totalAnalyses >= 6); // Min 6 calls

    // Sort Descending (Top)
    const top5 = [...qualified]
        .sort((a, b) => b.winRate - a.winRate || b.totalAnalyses - a.totalAnalyses)
        .slice(0, 5);

    // Sort Ascending (Bottom)
    const bottom5 = [...qualified]
        .sort((a, b) => a.winRate - b.winRate || b.totalAnalyses - a.totalAnalyses)
        .slice(0, 5);

    // 3. Overall Metrics
    // We can fetch from route logic or just re-aggregate if needed
    // But let's just use what we have in profiles for aggregation strictly or hit the API logic? 
    // Let's keep it simple and aggregation here.
    const totalAnalyses = profiles.reduce((acc, p) => acc + (parseInt(p.totalAnalyses) || 0), 0);
    const totalWins = profiles.reduce((acc, p) => acc + (parseInt(p.wins) || 0), 0);
    const totalLosses = profiles.reduce((acc, p) => acc + (parseInt(p.losses) || 0), 0);
    const winRate = Math.round((totalWins / (totalWins + totalLosses)) * 100) || 0;

    // 4. Trending Tickers (From recent global history)
    const recentRefs = await redis.zrange('global:analyses:timestamp', 0, 199, { rev: true }) as string[];
    const tickerMap: Record<string, { count: number, bullish: number, bearish: number }> = {};

    // We need to fetch the actual analysis content for these references
    const analysisPipeline = redis.pipeline();
    // Optimize: Group by user to fetch histories or just key access? 
    // The ref is user:timestamp. We actually need to find the item. 
    // Re-using route logic: grouping by user.
    const userMap: Record<string, Set<string>> = {};
    recentRefs.forEach(ref => {
        const [user, id] = ref.split(':');
        if (!userMap[user]) userMap[user] = new Set();
        userMap[user].add(id);
    });

    const userKeys = Object.keys(userMap);
    const histPipeline = redis.pipeline();
    userKeys.forEach(user => histPipeline.lrange(`user:history:${user}`, 0, -1));
    const histResults = await histPipeline.exec();

    histResults?.forEach((res: any, idx) => {
        const user = userKeys[idx];
        const targetIds = userMap[user];
        // Redis pipeline results are [error, result] tuples in some clients, or just result in others
        // In ioredis pipeline.exec(), it returns [[err, result], [err, result]]
        // But our wrapper might return direct results?
        // Let's assume standard ioredis behavior for pipeline.exec() which returns [err, res] tuples.
        // Wait, the error implies 'data' is not an array.

        // Let's inspect what 'res' is. 
        // If using local-redis-proxy or standard redis, ensure we handle the structure.
        // Quick fix: Check if it is an array before iterating.

        let data: any[] = [];
        if (Array.isArray(res)) {
            // If res is [err, [items...]] (ioredis standard)
            if (res[0] === null && Array.isArray(res[1])) {
                data = res[1];
            }
            // If local proxy/wrapper behaves differently returning the array directly? 
            else if (res.length > 0 && typeof res[0] === 'string') {
                // It might be the array of strings itself
                data = res;
            }
        }

        // Safety check
        if (!Array.isArray(data)) return;

        data.forEach((item: any) => {
            const p = typeof item === 'string' ? JSON.parse(item) : item;
            if (targetIds.has(String(p.id)) && p.symbol) {
                const s = p.symbol.toUpperCase();
                if (!tickerMap[s]) {
                    tickerMap[s] = { count: 0, bullish: 0, bearish: 0 };
                }
                tickerMap[s].count++;
                if (p.sentiment === 'BULLISH') tickerMap[s].bullish++;
                else tickerMap[s].bearish++;
            }
        });
    });

    const trending = Object.entries(tickerMap)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 5)
        .map(([s, stats]) => {
            const bullRate = Math.round((stats.bullish / stats.count) * 100);
            const sentimentEmoji = bullRate >= 50 ? '🟢' : '🔴';
            return `$${s} ${sentimentEmoji} ${bullRate}% Bullish`;
        });

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
    console.log(`� State of the Market Update

🧾 Total Verified Calls: ${totalAnalyses.toLocaleString()}
🎯 Global Win Rate: ${winRate}%
📉 Active Drawdowns: ${(100 - winRate)}%

Truth is the new asset class.
Verify the database 👇
https://sincethiscall.com/stats

#Data #Fintwit #Trading #Truth`);

    // 3. Top 5 Analysts Tweet
    console.log(`\n--- 3. Top 5 Analysts Tweet ---`);
    console.log(`� The Honor Roll: Top 5 Verified Analysts

${top5.map((p, i) => `${i + 1}. @${p.username} 🎯 ${p.winRate.toFixed(1)}%`).join('\n')}

These accounts are printing alpha. 
See their full records 👇
https://sincethiscall.com/leaderboard

#Fintwit #Crypto #Alpha #Leaderboard`);

    // 4. Bottom 5 Analysts Tweet
    console.log(`\n--- 4. Bottom 5 Analysts Tweet ---`);
    console.log(`💀 The Fade List: Lowest Win Rates (6+ Calls)

${bottom5.map((p, i) => `${i + 1}. @${p.username} ❌ ${p.winRate.toFixed(1)}%`).join('\n')}

Inverse accordingly.
Broadcasting receipts daily 👇
https://sincethiscall.com/leaderboard

#Fintwit #Trading #Inverse #Receipts`);

    console.log(`---------------------------------------`);

    process.exit(0);
}

generateTweet();
