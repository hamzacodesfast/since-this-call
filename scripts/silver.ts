import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getRedisClient } from '../src/lib/redis-client';

const redis = getRedisClient();

async function main() {
  const tickers = await redis.smembers('tracked_tickers') as string[];
  const silverTickers = tickers.filter(t => {
    const lower = t.toLowerCase();
    return lower === 'stock:slv' || lower === 'crypto:slv' || lower === 'crypto:silver' || lower === 'stock:silver' || lower === 'stock:xag' || lower === 'crypto:xag';
  });
  console.log('All silver tickers found:', silverTickers);

  let totalBullish = 0, totalBearish = 0, totalWins = 0, totalLosses = 0;
  const allCallers: any[] = [];
  const seenCalls = new Set<string>(); // dedup

  // Build the unified profile map
  console.log('Fetching all user profiles...');
  const allUsers = await redis.smembers('all_users') as string[];
  const profilesMap = new Map<string, any>();
  const profileBatch = 200;
  for (let i = 0; i < allUsers.length; i += profileBatch) {
    const batch = allUsers.slice(i, i + profileBatch);
    const pipe = redis.pipeline();
    for (const u of batch) pipe.hgetall('user:profile:' + u);
    const results = await pipe.exec();
    results.forEach((res: any, idx: number) => {
      profilesMap.set(batch[idx], res);
    });
  }
  console.log(`Fetched ${profilesMap.size} profiles.`);

  for (const tk of silverTickers) {
    const refs = await redis.zrange(`ticker_index:${tk}`, 0, -1) as string[];
    console.log(`\n--- Ticker: ${tk} | Refs: ${refs.length} ---`);

    const refsByUser = new Map<string, Set<string>>();
    for (const ref of refs) {
      const [username, id] = ref.split(':');
      if (!refsByUser.has(username.toLowerCase())) refsByUser.set(username.toLowerCase(), new Set());
      refsByUser.get(username.toLowerCase())!.add(id);
    }

    for (const [username, ids] of refsByUser.entries()) {
      const history = await redis.lrange(`user:history:${username}`, 0, -1);
      for (const d of history) {
        const call = typeof d === 'string' ? JSON.parse(d) : d;
        if (ids.has(call.id) && !seenCalls.has(`${username}:${call.id}`)) {
          seenCalls.add(`${username}:${call.id}`);
          if (call.sentiment === 'BULLISH') totalBullish++;
          else if (call.sentiment === 'BEARISH') totalBearish++;
          
          if (Math.abs(call.performance) >= 0.01) {
            if (call.isWin) totalWins++; else totalLosses++;
          }
          const profile = profilesMap.get(username) || {};
          allCallers.push({
            username: call.username || username,
            sentiment: call.sentiment,
            winRate: parseFloat(profile.winRate || 0),
            totalCalls: parseInt(profile.totalAnalyses || 0),
            performance: call.performance,
            timestamp: new Date(call.timestamp).toISOString(),
            confidence: call.confidence_score,
            ticker: tk
          });
        }
      }
    }
  }

  console.log('\n========== COMBINED SILVER SENTIMENT ==========');
  console.log('Total unique calls:', totalBullish + totalBearish);
  console.log('Bullish:', totalBullish, '(' + ((totalBullish / (totalBullish + totalBearish || 1)) * 100).toFixed(1) + '%)');
  console.log('Bearish:', totalBearish, '(' + ((totalBearish / (totalBullish + totalBearish || 1)) * 100).toFixed(1) + '%)');
  console.log('Wins:', totalWins, '| Losses:', totalLosses, '| WR:', ((totalWins / (totalWins + totalLosses || 1)) * 100).toFixed(1) + '%');

  const smart = allCallers.filter(c => c.winRate >= 60 && c.totalCalls >= 10);
  const mid = allCallers.filter(c => c.winRate >= 35 && c.winRate < 60 && c.totalCalls >= 5);
  const farmers = allCallers.filter(c => c.winRate < 35 && c.totalCalls >= 5);

  const smartBull = smart.filter(c => c.sentiment === 'BULLISH').length;
  const smartBear = smart.filter(c => c.sentiment === 'BEARISH').length;
  const midBull = mid.filter(c => c.sentiment === 'BULLISH').length;
  const midBear = mid.filter(c => c.sentiment === 'BEARISH').length;
  const farmBull = farmers.filter(c => c.sentiment === 'BULLISH').length;
  const farmBear = farmers.filter(c => c.sentiment === 'BEARISH').length;

  console.log('\n--- TIER BREAKDOWN ---');
  console.log('Smart Money (WR>=60%, 10c+):', smartBull, 'Bull /', smartBear, 'Bear →', smartBull > smartBear ? 'BULLISH' : smartBear > smartBull ? 'BEARISH' : 'SPLIT');
  console.log('Mid-Tier (35-60% WR, 5c+):', midBull, 'Bull /', midBear, 'Bear →', midBull > midBear ? 'BULLISH' : midBear > midBull ? 'BEARISH' : 'SPLIT');
  console.log('Farmers (<35% WR, 5c+):', farmBull, 'Bull /', farmBear, 'Bear →', farmBull > farmBear ? 'BULLISH' : farmBear > farmBull ? 'BEARISH' : 'SPLIT');

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = allCallers.filter(c => new Date(c.timestamp).getTime() > sevenDaysAgo);
  const recentBull = recent.filter(c => c.sentiment === 'BULLISH').length;
  const recentBear = recent.filter(c => c.sentiment === 'BEARISH').length;
  console.log('\n--- LAST 7 DAYS ---');
  console.log('Recent calls:', recent.length, '| Bull:', recentBull, '| Bear:', recentBear);

  const recentSmart = recent.filter(c => c.winRate >= 60 && c.totalCalls >= 10);
  console.log('Recent smart money calls:', recentSmart.length);
  for (const c of recentSmart.sort((a,b) => b.winRate - a.winRate)) {
    console.log('  🟢 @' + c.username + ' (' + c.winRate.toFixed(1) + '% WR) → ' + c.sentiment + ' | perf: ' + (c.performance > 0 ? '+' : '') + c.performance.toFixed(2) + '% | ' + c.timestamp.slice(0,10));
  }

  console.log('\n--- TOP 10 CALLERS BY WR (10c+ minimum) ---');
  const qualified = allCallers.filter(c => c.totalCalls >= 10).sort((a,b) => b.winRate - a.winRate);
  const seen = new Set();
  let count = 0;
  for (const c of qualified) {
    if (seen.has(c.username)) continue;
    seen.add(c.username);
    const tag = c.winRate >= 60 ? '🟢' : c.winRate < 35 ? '🔴' : '⚪';
    console.log('  ' + tag + ' @' + c.username + ' (' + c.winRate.toFixed(1) + '% WR, ' + c.totalCalls + 'c) → ' + c.sentiment + ' ' + c.ticker + ' | perf: ' + (c.performance > 0 ? '+' : '') + c.performance.toFixed(2) + '%');
    if (++count >= 10) break;
  }

  const withConv = allCallers.filter(c => c.confidence && c.confidence > 0);
  const avgConv = withConv.reduce((s,c) => s + c.confidence, 0) / (withConv.length || 1);
  console.log(`\nAvg Conviction Score: ${(avgConv * 100).toFixed(0)}%`);

  process.exit(0);
}

main().catch(console.error);
