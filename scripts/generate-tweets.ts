/**
 * @file scripts/generate-tweets.ts
 * @description Generates engaging tweets based on platform metrics.
 * Outputs to docs/generated_tweets.md
 */
import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const redis = getRedisClient();
    const output: string[] = [];

    // 1. Platform Metrics
    const metrics = await redis.get('platform_metrics') as any;

    output.push('## 1. Platform Metrics Tweet\n');
    if (metrics) {
        const totalAnalyses = metrics.totalAnalyses || 0;
        const uniqueGurus = metrics.uniqueGurus || 0;
        // Match precision (e.g. 44.5%)
        const winRate = metrics.winRate ? metrics.winRate.toFixed(1) : '0.0';
        const uniqueTickers = metrics.uniqueTickers || 0;

        output.push(`📊 Since This Call - Platform Update!

🔥 Total Calls analyzed: ${totalAnalyses.toLocaleString()}
👔 Total Financial Analysts: ${uniqueGurus.toLocaleString()}
📈 Average Analyst Win Rate: ${winRate}%
💎 Tracked Assets: ${uniqueTickers.toLocaleString()}

The truth is on-chain. Audit your guru. 🕵️‍♂️
#STC #Fintwit #Trading`);
    } else {
        output.push('❌ Error: distinct platform_metrics not found in Redis.');
    }
    output.push('\n---\n');

    // 2. Trending Tickers (from metrics.topTickers)
    output.push('## 2. Trending Tickers Tweet\n');
    if (metrics && metrics.topTickers && Array.isArray(metrics.topTickers)) {
        const top5 = metrics.topTickers.slice(0, 5);

        let tickerList = top5.map((t: any, i: number) => {
            const callCount = t.callCount || 0;
            const bullish = t.bullish || 0;
            const bearish = t.bearish || 0;
            const wins = t.wins || 0;
            const losses = t.losses || 0;

            // Ticker Win Rate (Wins / (Wins + Losses))
            const decided = wins + losses;
            const tickerWinRate = decided > 0 ? ((wins / decided) * 100).toFixed(0) : '0';

            // Sentiment %
            const bullishPct = callCount > 0 ? Math.round((bullish / callCount) * 100) : 0;
            const bearishPct = callCount > 0 ? Math.round((bearish / callCount) * 100) : 0;

            // Format: $BTC: 59% Win Rate | 79% Bullish (345 calls)
            return `${i + 1}. $${t.symbol}: ${tickerWinRate}% Win Rate | ${bullishPct}% Bullish (${callCount} calls)`;
        }).join('\n');

        output.push(`🔥 Top 5 Trending Tickers on STC:

${tickerList}

The herd is moving. Are you?
#STC #TradingSignals #Crypto #Stocks`);
    } else {
        output.push('❌ Error: topTickers not found in platform_metrics.');
    }
    output.push('\n---\n');

    // Fetch all profiles for Analyst Rankings
    const allUsers = await redis.smembers('all_users') as string[];
    const userProfiles = [];
    for (const user of allUsers) {
        const p = await redis.hgetall(`user:profile:${user}`) as any;
        if (p && p.username) {
            userProfiles.push({
                username: p.username,
                winRate: parseFloat(p.winRate || '0'),
                totalAnalyses: parseInt(p.totalAnalyses || '0')
            });
        }
    }

    // 3. Top Analysts
    // Filter: Minimum 15 calls matches platform leaderboard
    const topAnalysts = userProfiles
        .filter(u => u.totalAnalyses >= 15)
        .sort((a, b) => b.winRate - a.winRate || b.totalAnalyses - a.totalAnalyses)
        .slice(0, 5);

    output.push('## 3. Top 5 Analysts Tweet\n');
    let topList = topAnalysts.map((u, i) => {
        return `${i + 1}. @${u.username}: ${u.winRate.toFixed(1)}% WR (${u.totalAnalyses} calls)`;
    }).join('\n');

    output.push(`🏆 Top 5 Performing Analysts this week:

${topList}

Respect the data. 📈
#STC #Fintwit #EliteAnalysts`);
    output.push('\n---\n');

    // 4. Bottom Analysts
    // Filter: Minimum 15 calls matches platform leaderboard
    const bottomAnalysts = userProfiles
        .filter(u => u.totalAnalyses >= 15)
        .sort((a, b) => a.winRate - b.winRate || b.totalAnalyses - a.totalAnalyses)
        .slice(0, 5);

    output.push('## 4. Bottom 5 Analysts Tweet\n');
    let bottomList = bottomAnalysts.map((u, i) => {
        return `${i + 1}. @${u.username}: ${u.winRate.toFixed(1)}% WR (${u.totalAnalyses} calls)`;
    }).join('\n');

    output.push(`⚠️ Reality Check: Bottom 5 Analyst Win Rates:

${bottomList}

Numbers don't lie. Don't blindly follow the hype. 📉
#STC #TradingMistakes #AuditEverything`);
    output.push('\n---\n');

    // Save to file
    const outputPath = path.resolve(process.cwd(), 'docs/generated_tweets.md');
    fs.writeFileSync(outputPath, output.join('\n'));
    console.log(`✅ Tweets generated and saved to ${outputPath}`);
    process.exit(0);
}

main().catch(console.error);
