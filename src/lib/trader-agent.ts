/**
 * @file trader-agent.ts
 * @description STC Signals Engine V2 — High-Probability Recommendation Engine
 *
 * V2 Enhancements:
 *   - Ticker-Specific Win Rates: Per-ticker accuracy instead of global WR
 *   - Conviction Weighting: AI confidence_score (0-1) scales recommendation strength
 *   - Recency-Weighted Win Rate: Exponential decay so recent calls matter more
 *
 * Scans the existing Redis database of user profiles, analysis histories,
 * and ticker data to identify trade setups across 5 playbooks.
 *
 *
 * All functions are read-only — no data is mutated.
 */

import { getRedisClient } from './redis-client';
import type { StoredAnalysis, UserProfile } from './analysis-store';

const redis = getRedisClient();

// ─── Request-Level Cache ──────────────────────────────────────────────────────
// This prevents duplicate Redis requests across Playbooks during a single scan
let globalRequestCache: Map<string, any> = new Map();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnhancedMetrics {
    tickerWinRate: number | null;    // WR on this specific ticker (null = no data)
    tickerCalls: number;             // Number of calls on this ticker
    recentWinRate: number;           // EMA-weighted WR on last N calls
    recentStreak: string;            // "🔥 5W streak" or "❄️ 3L streak"
    avgConviction: number;           // Average confidence_score of their calls
    callConviction: number;          // confidence_score of THIS specific call
    momentum: 'HOT' | 'COLD' | 'NEUTRAL'; // Hot hand / cold streak
}

export interface SourceAccount {
    username: string;
    winRate: number;
    totalCalls: number;
    latestCall: StoredAnalysis;
    enhanced?: EnhancedMetrics;
}

export interface TradeRecommendation {
    playbook: string;
    signal: 'FADE' | 'COPY' | 'MEAN_REVERSION' | 'MOMENTUM' | 'MAX_CONVICTION';
    direction: 'LONG' | 'SHORT';
    ticker: string;
    tickerType: 'CRYPTO' | 'STOCK';
    confidence: 'LOW' | 'MEDIUM' | 'HIGH' | 'APEX';
    reasoning: string;
    sourceAccounts: SourceAccount[];
    timestamp: number;
    staleness: string;
    riskWarnings: string[];
}

export interface TraderScanResult {
    scanTimestamp: number;
    farmerFades: TradeRecommendation[];
    silentSnipers: TradeRecommendation[];
    smartMoneyDivergences: TradeRecommendation[];
    sectorRotations: TradeRecommendation[];
    dualSniperSignals: TradeRecommendation[];
    totalSignals: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatStaleness(timestampMs: number): string {
    const diff = Date.now() - timestampMs;
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

/** Fetch all user profiles from Redis (no pagination cap). */
async function fetchAllProfiles(): Promise<UserProfile[]> {
    const users = await redis.smembers('all_users') as string[];
    if (users.length === 0) return [];

    const pipeline = redis.pipeline();
    users.forEach(u => pipeline.hgetall(`user:profile:${u}`));
    const results = await pipeline.exec();

    const profiles: UserProfile[] = [];
    results.forEach((res: any) => {
        const data = res;
        if (data && data.username) {
            profiles.push({
                username: data.username,
                avatar: data.avatar || '',
                totalAnalyses: parseInt(data.totalAnalyses || '0'),
                wins: parseInt(data.wins || '0'),
                losses: parseInt(data.losses || '0'),
                neutral: parseInt(data.neutral || '0'),
                winRate: parseFloat(data.winRate || '0'),
                lastAnalyzed: parseInt(data.lastAnalyzed || '0'),
                isVerified: data.isVerified === 'true' || data.isVerified === true,
            });
        }
    });

    return profiles;
}

/** Fetch a user's most recent N calls from their history list (Cache-Backed). */
async function fetchUserHistory(username: string, limit: number = 5): Promise<StoredAnalysis[]> {
    const key = `user:history:${username.toLowerCase()}`;
    if (limit === 100 && globalRequestCache.has(key)) {
        return globalRequestCache.get(key);
    }

    const data = await redis.lrange(key, 0, limit - 1);
    const parsed = data.map((item: any) => (typeof item === 'string' ? JSON.parse(item) : item));

    if (limit === 100) {
        globalRequestCache.set(key, parsed);
    }

    return parsed;
}

/** Pre-warm the global cache with histories for multiple users in a single pipeline. */
async function fetchMultipleUserHistories(usernames: string[], limit: number = 100): Promise<void> {
    const uniqueUsers = Array.from(new Set(usernames.map(u => u.toLowerCase())));
    const needed = uniqueUsers.filter(u => !globalRequestCache.has(`user:history:${u}`));
    
    if (needed.length === 0) return;

    const pipeline = redis.pipeline();
    needed.forEach(u => pipeline.lrange(`user:history:${u}`, 0, limit - 1));
    const results = await pipeline.exec();

    results.forEach((res: any, i) => {
        const data = res;
        const parsed = data ? data.map((item: any) => (typeof item === 'string' ? JSON.parse(item) : item)) : [];
        if (limit === 100) {
            globalRequestCache.set(`user:history:${needed[i]}`, parsed);
        }
    });
}

// ─── V2: Enhanced Metrics Engine ──────────────────────────────────────────────

/**
 * Compute the recency-weighted win rate using Exponential Moving Average.
 * Recent calls are weighted exponentially more than old calls.
 * Decay factor α = 0.15 means the most recent call has ~15% weight,
 * the next ~13%, etc. — effectively the last 10-15 calls dominate.
 */
function computeRecentWinRate(history: StoredAnalysis[]): { recentWR: number; streak: string; momentum: 'HOT' | 'COLD' | 'NEUTRAL' } {
    if (history.length === 0) return { recentWR: 0, streak: '—', momentum: 'NEUTRAL' };

    const ALPHA = 0.15;
    let ema = 0;
    let weight = 0;

    // History is newest-first, we process in order (newest = highest weight)
    for (let i = 0; i < history.length; i++) {
        const call = history[i];
        const isNeutral = Math.abs(call.performance) < 0.01;
        if (isNeutral) continue;

        const w = Math.pow(1 - ALPHA, i); // Exponential decay
        ema += (call.isWin ? 1 : 0) * w;
        weight += w;
    }

    const recentWR = weight > 0 ? (ema / weight) * 100 : 0;

    // Compute current streak
    let streakType: 'W' | 'L' | null = null;
    let streakCount = 0;
    for (const call of history) {
        if (Math.abs(call.performance) < 0.01) continue;
        const thisType = call.isWin ? 'W' : 'L';
        if (streakType === null) {
            streakType = thisType;
            streakCount = 1;
        } else if (thisType === streakType) {
            streakCount++;
        } else {
            break;
        }
    }

    const streak = streakType === 'W'
        ? `🔥 ${streakCount}W streak`
        : streakType === 'L'
            ? `❄️ ${streakCount}L streak`
            : '—';

    // Momentum: compare recent EMA WR to their lifetime behavior
    const momentum: 'HOT' | 'COLD' | 'NEUTRAL' =
        streakCount >= 3 && streakType === 'W' ? 'HOT' :
        streakCount >= 3 && streakType === 'L' ? 'COLD' :
        'NEUTRAL';

    return { recentWR, streak, momentum };
}

/**
 * Compute ticker-specific win rate from a user's full history.
 */
function computeTickerWinRate(history: StoredAnalysis[], ticker: string): { tickerWR: number | null; tickerCalls: number } {
    const tickerCalls = history.filter(c => c.symbol.toUpperCase() === ticker.toUpperCase());
    if (tickerCalls.length === 0) return { tickerWR: null, tickerCalls: 0 };

    const decided = tickerCalls.filter(c => Math.abs(c.performance) >= 0.01);
    if (decided.length === 0) return { tickerWR: null, tickerCalls: tickerCalls.length };

    const wins = decided.filter(c => c.isWin).length;
    return { tickerWR: (wins / decided.length) * 100, tickerCalls: tickerCalls.length };
}

/**
 * Compute average conviction score from a user's history.
 */
function computeAvgConviction(history: StoredAnalysis[]): number {
    const withScore = history.filter(c => c.confidence_score != null && c.confidence_score > 0);
    if (withScore.length === 0) return 0.5; // Default neutral
    return withScore.reduce((sum, c) => sum + (c.confidence_score || 0), 0) / withScore.length;
}

/**
 * Build full enhanced metrics for a user relative to a specific call.
 */
async function buildEnhancedMetrics(username: string, targetCall: StoredAnalysis, fullHistory?: StoredAnalysis[]): Promise<EnhancedMetrics> {
    const history = fullHistory || await fetchUserHistory(username, 100);
    const { recentWR, streak, momentum } = computeRecentWinRate(history);
    const { tickerWR, tickerCalls } = computeTickerWinRate(history, targetCall.symbol);
    const avgConviction = computeAvgConviction(history);
    const callConviction = targetCall.confidence_score || 0.5;

    return {
        tickerWinRate: tickerWR,
        tickerCalls,
        recentWinRate: recentWR,
        recentStreak: streak,
        avgConviction,
        callConviction,
        momentum,
    };
}

/**
 * Determine effective confidence by combining multiple V2 signals.
 * This upgrades or downgrades the base confidence level.
 */
function adjustConfidence(
    base: TradeRecommendation['confidence'],
    enhanced: EnhancedMetrics,
    mode: 'copy' | 'fade'
): TradeRecommendation['confidence'] {
    const levels: TradeRecommendation['confidence'][] = ['LOW', 'MEDIUM', 'HIGH', 'APEX'];
    let idx = levels.indexOf(base);

    if (mode === 'copy') {
        // For COPY signals: boost if recent WR is hot + high conviction call
        if (enhanced.momentum === 'HOT' && enhanced.callConviction >= 0.8) idx = Math.min(idx + 1, 2); // Cap at HIGH
        if (enhanced.tickerWinRate !== null && enhanced.tickerWinRate >= 80 && enhanced.tickerCalls >= 5) idx = Math.min(idx + 1, 2);
        // Downgrade if cold streak or low conviction
        if (enhanced.momentum === 'COLD') idx = Math.max(idx - 1, 0);
        if (enhanced.callConviction < 0.3) idx = Math.max(idx - 1, 0);
    } else {
        // For FADE signals: boost if the farmer is ALSO bad at THIS specific ticker
        if (enhanced.tickerWinRate !== null && enhanced.tickerWinRate <= 10 && enhanced.tickerCalls >= 5) idx = Math.min(idx + 1, 2);
        // Boost if high conviction call from a low WR account (they're most confident = most wrong)
        if (enhanced.callConviction >= 0.8) idx = Math.min(idx + 1, 2);
        // Downgrade if they're recently doing better (cold streak breaking)
        if (enhanced.momentum === 'HOT') idx = Math.max(idx - 1, 0);
    }

    return levels[idx];
}

// ─── Playbook 1: Inverse Engagement Farmer ────────────────────────────────────

export async function scanFarmerFades(): Promise<TradeRecommendation[]> {
    const profiles = await fetchAllProfiles();
    const recommendations: TradeRecommendation[] = [];

    // Filter: 30+ calls, WR < 30%
    const farmers = profiles.filter(p => p.totalAnalyses >= 30 && p.winRate < 30);

    // Pre-warm cache for all farmers
    await fetchMultipleUserHistories(farmers.map(f => f.username), 100);

    for (const farmer of farmers) {
        const history = await fetchUserHistory(farmer.username, 100);
        if (history.length === 0) continue;

        const latestCall = history[0];
        const isZeroPercent = farmer.winRate === 0 && farmer.totalAnalyses >= 40;

        // V2: Build enhanced metrics
        const enhanced = await buildEnhancedMetrics(farmer.username, latestCall, history);

        // Precision Refinement: Min 0.5 conviction to avoid casual mentions
        if (enhanced.callConviction < 0.5) continue;

        // Fade direction: opposite of their call
        const direction: 'LONG' | 'SHORT' =
            latestCall.sentiment === 'BULLISH' ? 'SHORT' : 'LONG';

        const baseConfidence: TradeRecommendation['confidence'] = isZeroPercent
            ? 'HIGH'
            : farmer.winRate < 20
                ? 'MEDIUM'
                : 'LOW';

        const confidence = adjustConfidence(baseConfidence, enhanced, 'fade');

        // V2: Build enhanced reasoning
        const tickerContext = enhanced.tickerWinRate !== null
            ? ` Their $${latestCall.symbol}-specific WR is ${enhanced.tickerWinRate.toFixed(0)}% across ${enhanced.tickerCalls} calls on this ticker.`
            : '';
        const momentumContext = enhanced.momentum !== 'NEUTRAL'
            ? ` Currently on a ${enhanced.recentStreak} (Recent WR: ${enhanced.recentWinRate.toFixed(0)}%).`
            : '';
        const convictionContext = enhanced.callConviction >= 0.7
            ? ` High conviction call (${(enhanced.callConviction * 100).toFixed(0)}% confidence) — they\'re most sure when they\'re most wrong.`
            : '';

        recommendations.push({
            playbook: isZeroPercent
                ? '🔥 Zero-Percent Anomaly (Playbook 1)'
                : '🔄 Inverse Engagement Farmer (Playbook 1)',
            signal: 'FADE',
            direction,
            ticker: latestCall.symbol,
            tickerType: (latestCall.type as 'CRYPTO' | 'STOCK') || 'CRYPTO',
            confidence,
            reasoning: isZeroPercent
                ? `@${farmer.username} has ${farmer.totalAnalyses} tracked calls with a literal 0% Win Rate. They called ${latestCall.sentiment} on $${latestCall.symbol} — fade it.${tickerContext}${convictionContext}${momentumContext}`
                : `@${farmer.username} has a ${farmer.winRate.toFixed(1)}% Win Rate across ${farmer.totalAnalyses} calls. They just called ${latestCall.sentiment} on $${latestCall.symbol}.${tickerContext}${convictionContext}${momentumContext}`,
            sourceAccounts: [{
                username: farmer.username,
                winRate: farmer.winRate,
                totalCalls: farmer.totalAnalyses,
                latestCall,
                enhanced,
            }],
            timestamp: latestCall.timestamp,
            staleness: formatStaleness(latestCall.timestamp),
            riskWarnings: [
                'Broken Clock Rule: Even a 20% WR trader gets it right 1/5 times.',
                'Never risk more than 2-3% of portfolio on a single Fade recommendation.',
                ...(enhanced.momentum === 'HOT' ? ['⚠️ CAUTION: This farmer is on a recent winning streak — fade signal weakened.'] : []),
                ...(isZeroPercent ? ['Zero-Percent anomalies are rare — verify the account has not been recently purged/reset.'] : []),
            ]
        });
    }

    // Sort: 0% anomalies first, then by lowest WR, then by recent WR (lowest = best fade)
    recommendations.sort((a, b) => {
        const aZero = a.playbook.includes('Zero-Percent') ? 0 : 1;
        const bZero = b.playbook.includes('Zero-Percent') ? 0 : 1;
        if (aZero !== bZero) return aZero - bZero;
        const wrDiff = a.sourceAccounts[0].winRate - b.sourceAccounts[0].winRate;
        if (wrDiff !== 0) return wrDiff;
        // Tie-break: lower recent WR = stronger fade
        return (a.sourceAccounts[0].enhanced?.recentWinRate || 0) - (b.sourceAccounts[0].enhanced?.recentWinRate || 0);
    });

    return recommendations;
}

// ─── Playbook 2: Silent Sniper Follow ─────────────────────────────────────────

export async function scanSilentSnipers(): Promise<TradeRecommendation[]> {
    const profiles = await fetchAllProfiles();
    const recommendations: TradeRecommendation[] = [];

    // Filter: 25+ calls, WR > 75%
    const snipers = profiles.filter(p => p.totalAnalyses >= 25 && p.winRate > 75);

    // Pre-warm cache for all snipers
    await fetchMultipleUserHistories(snipers.map(s => s.username), 100);

    for (const sniper of snipers) {
        const history = await fetchUserHistory(sniper.username, 100);
        if (history.length === 0) continue;

        const latestCall = history[0];

        // V2: Build enhanced metrics
        const enhanced = await buildEnhancedMetrics(sniper.username, latestCall, history);

        // Precision Refinement: Min 0.5 conviction
        if (enhanced.callConviction < 0.5) continue;

        // Check "silence" — gap between last two calls > 3 days, or only 1 recent call
        let isSilentThenSpeaks = false;
        if (history.length >= 2) {
            const gap = history[0].timestamp - history[1].timestamp;
            isSilentThenSpeaks = gap > 3 * 24 * 60 * 60 * 1000; // 3 days
        } else {
            isSilentThenSpeaks = true;
        }

        const direction: 'LONG' | 'SHORT' =
            latestCall.sentiment === 'BULLISH' ? 'LONG' : 'SHORT';

        const baseConfidence: TradeRecommendation['confidence'] =
            sniper.winRate >= 85 && sniper.totalAnalyses >= 20
                ? 'HIGH'
                : sniper.winRate >= 75
                    ? 'MEDIUM'
                    : 'LOW';

        let confidence = adjustConfidence(
            isSilentThenSpeaks && baseConfidence !== 'LOW' ? 'HIGH' : baseConfidence,
            enhanced,
            'copy'
        );

        // V2: Build enhanced reasoning
        const tickerContext = enhanced.tickerWinRate !== null
            ? ` Their $${latestCall.symbol}-specific WR: ${enhanced.tickerWinRate.toFixed(0)}% (${enhanced.tickerCalls} calls).`
            : '';
        const recentContext = ` Recent form: ${enhanced.recentWinRate.toFixed(0)}% WR (${enhanced.recentStreak}).`;
        const convictionContext = enhanced.callConviction >= 0.7
            ? ` High conviction call (${(enhanced.callConviction * 100).toFixed(0)}% confidence).`
            : enhanced.callConviction <= 0.3
                ? ` Low conviction (${(enhanced.callConviction * 100).toFixed(0)}%) — may be a casual mention.`
                : '';

        recommendations.push({
            playbook: isSilentThenSpeaks
                ? '🎯 Silent Sniper Awakens (Playbook 2)'
                : '🎯 High-Accuracy Follow (Playbook 2)',
            signal: 'COPY',
            direction,
            ticker: latestCall.symbol,
            tickerType: (latestCall.type as 'CRYPTO' | 'STOCK') || 'CRYPTO',
            confidence,
            reasoning: isSilentThenSpeaks
                ? `@${sniper.username} (${sniper.winRate.toFixed(1)}% WR, ${sniper.totalAnalyses} calls) broke a period of silence to call ${latestCall.sentiment} on $${latestCall.symbol}.${tickerContext}${recentContext}${convictionContext}`
                : `@${sniper.username} has a ${sniper.winRate.toFixed(1)}% Win Rate across ${sniper.totalAnalyses} calls. Latest: ${latestCall.sentiment} $${latestCall.symbol}.${tickerContext}${recentContext}${convictionContext}`,
            sourceAccounts: [{
                username: sniper.username,
                winRate: sniper.winRate,
                totalCalls: sniper.totalAnalyses,
                latestCall,
                enhanced,
            }],
            timestamp: latestCall.timestamp,
            staleness: formatStaleness(latestCall.timestamp),
            riskWarnings: [
                'Stale Data Risk: Verify the timestamp — this call may have already played out.',
                ...(enhanced.momentum === 'COLD' ? ['⚠️ CAUTION: This sniper is on a recent cold streak — accuracy may be declining.'] : []),
                ...(enhanced.callConviction < 0.3 ? ['Low conviction call — may be a casual mention, not a strong thesis.'] : []),
                ...(sniper.totalAnalyses < 30 ? [`Sample size of ${sniper.totalAnalyses} calls is relatively small.`] : []),
            ]
        });
    }

    // Sort by: hot momentum first, then WR descending, then recent WR descending
    recommendations.sort((a, b) => {
        const aHot = a.sourceAccounts[0].enhanced?.momentum === 'HOT' ? 0 : 1;
        const bHot = b.sourceAccounts[0].enhanced?.momentum === 'HOT' ? 0 : 1;
        if (aHot !== bHot) return aHot - bHot;
        const wrDiff = b.sourceAccounts[0].winRate - a.sourceAccounts[0].winRate;
        if (wrDiff !== 0) return wrDiff;
        return (b.sourceAccounts[0].enhanced?.recentWinRate || 0) - (a.sourceAccounts[0].enhanced?.recentWinRate || 0);
    });

    return recommendations;
}

// ─── Playbook 3: Smart Money Divergence ───────────────────────────────────────

export async function scanSmartMoneyDivergence(): Promise<TradeRecommendation[]> {
    const profiles = await fetchAllProfiles();
    const recommendations: TradeRecommendation[] = [];

    // V2: Smart money filtered by RECENT performance, not just lifetime WR
    // Fetch full histories for potential smart money to compute recency
    const potentialSmart = profiles.filter(p => p.totalAnalyses >= 25 && p.winRate > 70);
    
    // Pre-warm histories for potential smart money
    await fetchMultipleUserHistories(potentialSmart.map(p => p.username), 100);

    const smartHistories = new Map<string, StoredAnalysis[]>();
    const confirmedSmart: UserProfile[] = [];

    for (const p of potentialSmart) {
        const history = await fetchUserHistory(p.username, 100);
        const { recentWR } = computeRecentWinRate(history);
        // V2: Only count as "smart money" if BOTH lifetime AND recent WR are strong
        if (p.winRate > 75 || (p.winRate > 70 && recentWR > 70)) {
            confirmedSmart.push(p);
            smartHistories.set(p.username.toLowerCase(), history);
        }
    }

    const smartMoneySet = new Set(confirmedSmart.map(p => p.username.toLowerCase()));
    const smartMoneyMap = new Map(confirmedSmart.map(p => [p.username.toLowerCase(), p]));

    // Get all tracked tickers
    const tickerKeys = (await redis.smembers('tracked_tickers') as string[]).filter(k => !k.startsWith('CA:'));
    
    // Bulk fetch ALL ticker indices in one pipeline
    const tickerPipeline = redis.pipeline();
    tickerKeys.forEach(tk => tickerPipeline.zrange(`ticker_index:${tk}`, 0, -1));
    const allRefsResults = await tickerPipeline.exec();
    
    // Collect all users mentioned in these indices to pre-warm their histories
    const allMentionedUsers = new Set<string>();
    allRefsResults.forEach((res: any) => {
        const refs = res || [];
        refs.forEach((ref: string) => {
            const [username] = ref.split(':');
            allMentionedUsers.add(username.toLowerCase());
        });
    });
    
    // Pre-warm ALL mentioned users
    await fetchMultipleUserHistories(Array.from(allMentionedUsers), 100);

    for (let i = 0; i < tickerKeys.length; i++) {
        const tickerKey = tickerKeys[i];
        const refs = allRefsResults[i] as string[];
        if (!refs || refs.length < 10) continue;

        let crowdBullish = 0;
        let crowdBearish = 0;
        let smartBullish = 0;
        let smartBearish = 0;
        const smartSources: SourceAccount[] = [];

        for (const ref of refs) {
            const [username, id] = ref.split(':');
            const lowerUser = username.toLowerCase();

            const historyData = await fetchUserHistory(lowerUser, 100);
            for (const d of historyData) {
                const call = d;
                if (call.id !== id) continue;

                if (call.sentiment === 'BULLISH') crowdBullish++;
                else if (call.sentiment === 'BEARISH') crowdBearish++;

                if (smartMoneySet.has(lowerUser)) {
                    if (call.sentiment === 'BULLISH') smartBullish++;
                    else if (call.sentiment === 'BEARISH') smartBearish++;

                    if (!smartSources.some(s => s.username.toLowerCase() === lowerUser)) {
                        const profile = smartMoneyMap.get(lowerUser)!;
                        const history = smartHistories.get(lowerUser);
                        const enhanced = history
                            ? await buildEnhancedMetrics(profile.username, call, history)
                            : undefined;

                        smartSources.push({
                            username: profile.username,
                            winRate: profile.winRate,
                            totalCalls: profile.totalAnalyses,
                            latestCall: call,
                            enhanced,
                        });
                    }
                }
                break;
            }
        }

        const totalCrowd = crowdBullish + crowdBearish;
        const totalSmart = smartBullish + smartBearish;
        if (totalCrowd < 10 || totalSmart < 5) continue;

        const crowdBullPct = (crowdBullish / totalCrowd) * 100;
        const smartBullPct = (smartBullish / totalSmart) * 100;

        const isDivergent =
            (crowdBullPct > 70 && smartBullPct < 40) ||
            (crowdBullPct < 30 && smartBullPct > 60);

        if (!isDivergent) continue;

        const [type, symbol] = tickerKey.split(':');
        const smartDirection: 'LONG' | 'SHORT' = smartBullPct > 50 ? 'LONG' : 'SHORT';
        const latestSmartCall = smartSources.sort((a, b) => b.latestCall.timestamp - a.latestCall.timestamp)[0];

        // V2: Check if smart money sources have hot momentum (strengthens signal)
        const hotSmartCount = smartSources.filter(s => s.enhanced?.momentum === 'HOT').length;

        recommendations.push({
            playbook: '🧠 Smart Money Divergence (Playbook 3)',
            signal: 'MEAN_REVERSION',
            direction: smartDirection,
            ticker: symbol,
            tickerType: (type as 'CRYPTO' | 'STOCK') || 'CRYPTO',
            confidence: (totalSmart >= 5 || hotSmartCount >= 2) ? 'HIGH' : 'MEDIUM',
            reasoning: `$${symbol}: The crowd is ${crowdBullPct.toFixed(0)}% Bullish, but smart money (WR > 60%) is ${smartBullPct.toFixed(0)}% Bullish. ${smartSources.length} high-accuracy accounts diverging from consensus.${hotSmartCount > 0 ? ` ${hotSmartCount} are on hot streaks — recent form confirms the contrarian thesis.` : ''}`,
            sourceAccounts: smartSources.slice(0, 5),
            timestamp: latestSmartCall?.latestCall.timestamp || Date.now(),
            staleness: formatStaleness(latestSmartCall?.latestCall.timestamp || Date.now()),
            riskWarnings: [
                'Divergence signals work best at extreme sentiment readings.',
                'Confirm with price action — not all divergences resolve immediately.',
            ]
        });
    }

    return recommendations;
}

// ─── Playbook 4: Sector Rotation Anomaly ──────────────────────────────────────

export async function scanSectorRotation(): Promise<TradeRecommendation[]> {
    const profiles = await fetchAllProfiles();
    const recommendations: TradeRecommendation[] = [];

    const smartMoneySet = new Set(
        profiles.filter(p => p.totalAnalyses >= 25 && p.winRate > 70)
            .map(p => p.username.toLowerCase())
    );

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    const recentRefs = await redis.zrange(
        'global:analyses:timestamp',
        twentyFourHoursAgo,
        now,
        { byScore: true }
    ) as string[];

    const tickerVolume: Record<string, {
        total: number;
        smartTotal: number;
        bullish: number;
        bearish: number;
        sources: SourceAccount[];
        avgConviction: number;
        convictionSum: number;
        convictionCount: number;
    }> = {};

    // Pre-warm histories for recent refs
    const usersToPrewarm = recentRefs.map(ref => ref.split(':')[0]);
    await fetchMultipleUserHistories(usersToPrewarm, 100);

    for (const ref of recentRefs) {
        const [username, id] = ref.split(':');
        const lowerUser = username.toLowerCase();
        const isSmart = smartMoneySet.has(lowerUser);

        const historyData = await fetchUserHistory(lowerUser, 100);
        for (const d of historyData) {
            const call = d;
            if (call.id !== id) continue;

            const symbol = call.symbol.toUpperCase();
            if (!tickerVolume[symbol]) {
                tickerVolume[symbol] = { total: 0, smartTotal: 0, bullish: 0, bearish: 0, sources: [], avgConviction: 0, convictionSum: 0, convictionCount: 0 };
            }

            tickerVolume[symbol].total++;
            if (isSmart) tickerVolume[symbol].smartTotal++;
            if (call.sentiment === 'BULLISH') tickerVolume[symbol].bullish++;
            else if (call.sentiment === 'BEARISH') tickerVolume[symbol].bearish++;

            // V2: Track conviction scores
            if (call.confidence_score != null && call.confidence_score > 0) {
                tickerVolume[symbol].convictionSum += call.confidence_score;
                tickerVolume[symbol].convictionCount++;
            }

            if (isSmart) {
                const profile = profiles.find(p => p.username.toLowerCase() === lowerUser);
                if (profile && !tickerVolume[symbol].sources.some(s => s.username === profile.username)) {
                    tickerVolume[symbol].sources.push({
                        username: profile.username,
                        winRate: profile.winRate,
                        totalCalls: profile.totalAnalyses,
                        latestCall: call,
                    });
                }
            }
            break;
        }
    }

    for (const [symbol, data] of Object.entries(tickerVolume)) {
        if (data.total < 15) continue;
        if (data.smartTotal < 5) continue;

        const smartRatio = data.smartTotal / data.total;
        if (smartRatio < 0.6) continue;

        // V2: Factor in average conviction of the calls
        data.avgConviction = data.convictionCount > 0 ? data.convictionSum / data.convictionCount : 0.5;

        const dominantSentiment: 'LONG' | 'SHORT' = data.bullish >= data.bearish ? 'LONG' : 'SHORT';
        const highConviction = data.avgConviction >= 0.7;

        recommendations.push({
            playbook: '🔄 Sector Rotation Anomaly (Playbook 4)',
            signal: 'MOMENTUM',
            direction: dominantSentiment,
            ticker: symbol,
            tickerType: data.sources[0]?.latestCall.type as 'CRYPTO' | 'STOCK' || 'CRYPTO',
            confidence: (data.total >= 10 && smartRatio > 0.5) || highConviction ? 'HIGH' : 'MEDIUM',
            reasoning: `$${symbol} has ${data.total} calls in the last 24h (${data.smartTotal} from high-WR accounts). ${data.bullish} Bullish / ${data.bearish} Bearish. Smart money ${(smartRatio * 100).toFixed(0)}% of volume.${highConviction ? ` Avg conviction: ${(data.avgConviction * 100).toFixed(0)}% — high conviction rotation.` : ''}`,
            sourceAccounts: data.sources.slice(0, 5),
            timestamp: data.sources[0]?.latestCall.timestamp || Date.now(),
            staleness: formatStaleness(data.sources[0]?.latestCall.timestamp || Date.now()),
            riskWarnings: [
                'Volume spikes can be noise — confirm the rotation narrative with price action.',
                'Momentum signals degrade fast. Act early or not at all.',
            ]
        });
    }

    recommendations.sort((a, b) => {
        const aVol = tickerVolume[a.ticker]?.total || 0;
        const bVol = tickerVolume[b.ticker]?.total || 0;
        return bVol - aVol;
    });

    return recommendations;
}

// ─── Playbook 5: Dual Sniper Confluence (Apex Signal) ─────────────────────────

export async function scanDualSniperConfluence(): Promise<TradeRecommendation[]> {
    const profiles = await fetchAllProfiles();
    const recommendations: TradeRecommendation[] = [];

    const qualified = profiles
        .filter(p => p.totalAnalyses >= 20 && p.winRate > 85)
        .sort((a, b) => b.winRate - a.winRate || b.totalAnalyses - a.totalAnalyses)
        .slice(0, 10);

    if (qualified.length < 2) return [];

    // Pre-warm histories for top 10 snipers
    await fetchMultipleUserHistories(qualified.map(q => q.username), 100);

    // V2: Fetch deeper history and compute enhanced metrics for each Top 10
    const topCalls: { profile: UserProfile; call: StoredAnalysis; enhanced: EnhancedMetrics }[] = [];
    for (const profile of qualified) {
        const history = await fetchUserHistory(profile.username, 100);
        if (history.length > 0) {
            const enhanced = await buildEnhancedMetrics(profile.username, history[0], history);
            topCalls.push({ profile, call: history[0], enhanced });
        }
    }

    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    const groups: Record<string, { profile: UserProfile; call: StoredAnalysis; enhanced: EnhancedMetrics }[]> = {};
    for (const entry of topCalls) {
        if (now - entry.call.timestamp > 7 * 24 * 60 * 60 * 1000) continue;

        const key = `${entry.call.symbol.toUpperCase()}:${entry.call.sentiment}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(entry);
    }

    for (const [key, entries] of Object.entries(groups)) {
        if (entries.length < 2) continue;

        entries.sort((a, b) => b.call.timestamp - a.call.timestamp);
        let hasConfluence = false;
        for (let i = 0; i < entries.length - 1; i++) {
            if (entries[i].call.timestamp - entries[i + 1].call.timestamp <= twentyFourHours) {
                hasConfluence = true;
                break;
            }
        }

        if (!hasConfluence) continue;

        const [symbol, sentiment] = key.split(':');
        const direction: 'LONG' | 'SHORT' = sentiment === 'BULLISH' ? 'LONG' : 'SHORT';
        const latestEntry = entries[0];

        // V2: Enhanced reasoning with recency and conviction data
        const hotCount = entries.filter(e => e.enhanced.momentum === 'HOT').length;
        const avgConviction = entries.reduce((s, e) => s + e.enhanced.callConviction, 0) / entries.length;

        recommendations.push({
            playbook: '👑 Dual Sniper Confluence — Apex Signal (Playbook 5)',
            signal: 'MAX_CONVICTION',
            direction,
            ticker: symbol,
            tickerType: (latestEntry.call.type as 'CRYPTO' | 'STOCK') || 'CRYPTO',
            confidence: 'APEX',
            reasoning: `${entries.length} Top 10 accounts independently called ${sentiment} on $${symbol}. ${entries.map(e => `@${e.profile.username} (${e.profile.winRate.toFixed(1)}% WR, recent: ${e.enhanced.recentWinRate.toFixed(0)}%, ${e.enhanced.recentStreak})`).join(', ')}.${hotCount > 0 ? ` ${hotCount}/${entries.length} are on hot streaks.` : ''} Avg conviction: ${(avgConviction * 100).toFixed(0)}%.`,
            sourceAccounts: entries.map(e => ({
                username: e.profile.username,
                winRate: e.profile.winRate,
                totalCalls: e.profile.totalAnalyses,
                latestCall: e.call,
                enhanced: e.enhanced,
            })),
            timestamp: latestEntry.call.timestamp,
            staleness: formatStaleness(latestEntry.call.timestamp),
            riskWarnings: [
                'Apex signals are the highest conviction but also the rarest.',
                'Stale Data Risk: Verify exact timestamps — both calls may have already played out.',
            ]
        });
    }

    return recommendations;
}

// ─── Full Scan Orchestrator ───────────────────────────────────────────────────

export async function runFullScan(): Promise<TraderScanResult> {
    console.log('[TraderAgent V2] Starting full scan with enhanced metrics...');
    const startTime = Date.now();

    // Clear request cache at start of scan to prevent memory leaks across edge invocations
    globalRequestCache = new Map();

    const [farmerFades, silentSnipers, smartMoneyDivergences, sectorRotations, dualSniperSignals] =
        await Promise.all([
            scanFarmerFades(),
            scanSilentSnipers(),
            scanSmartMoneyDivergence(),
            scanSectorRotation(),
            scanDualSniperConfluence(),
        ]);

    const totalSignals =
        farmerFades.length +
        silentSnipers.length +
        smartMoneyDivergences.length +
        sectorRotations.length +
        dualSniperSignals.length;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[TraderAgent V2] Scan complete in ${elapsed}s. ${totalSignals} signals found.`);

    return {
        scanTimestamp: Date.now(),
        farmerFades,
        silentSnipers,
        smartMoneyDivergences,
        sectorRotations,
        dualSniperSignals,
        totalSignals,
    };
}
