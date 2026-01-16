import { Redis } from '@upstash/redis';
import { StoredAnalysis, recalculateUserProfile } from './analysis-store';
import { calculatePerformance } from './market-data';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest/dex';

// CoinGecko ID mapping (same as market-data.ts)
const COINGECKO_IDS: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'DOGE': 'dogecoin',
    'XRP': 'ripple',
    'BNB': 'binancecoin',
    'LTC': 'litecoin',
    'ADA': 'cardano',
    'AVAX': 'avalanche-2',
    'DOT': 'polkadot',
    'MATIC': 'matic-network',
    'LINK': 'chainlink',
    'PEPE': 'pepe',
    'SHIB': 'shiba-inu',
    'HYPE': 'hyperliquid',
    'WIF': 'dogwifcoin',
    'BONK': 'bonk',
    'PENGU': 'pudgy-penguins',
    'JUP': 'jupiter-exchange-solana',
    'AI16Z': 'ai16z',
    'FARTCOIN': 'fartcoin',
    'VIRTUAL': 'virtual-protocol',
    'SPX6900': 'spx6900',
    'TON': 'the-open-network',
};

interface RefreshResult {
    updated: number;
    errors: number;
    skipped: number;
}

/**
 * Batch fetch prices from CoinGecko.
 * Returns a map of symbol -> price.
 */
async function batchFetchCoinGeckoPrices(symbols: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    // Convert symbols to CoinGecko IDs
    const ids = symbols
        .map(s => COINGECKO_IDS[s.toUpperCase()])
        .filter(Boolean);

    if (ids.length === 0) return prices;

    const apiKey = process.env.COINGECKO_API_KEY;
    const headers: Record<string, string> = {
        'Accept': 'application/json',
    };
    if (apiKey) {
        headers['x-cg-demo-api-key'] = apiKey;
    }

    try {
        const url = `${COINGECKO_BASE}/simple/price?ids=${ids.join(',')}&vs_currencies=usd`;
        console.log(`[PriceRefresher] Fetching ${ids.length} CoinGecko prices...`);

        const res = await fetch(url, { headers, cache: 'no-store' });
        if (!res.ok) {
            console.error(`[PriceRefresher] CoinGecko error: ${res.status}`);
            return prices;
        }

        const data = await res.json();

        // Map back to symbols
        for (const symbol of symbols) {
            const cgId = COINGECKO_IDS[symbol.toUpperCase()];
            if (cgId && data[cgId]?.usd) {
                prices.set(symbol.toUpperCase(), data[cgId].usd);
            }
        }

        console.log(`[PriceRefresher] Got ${prices.size} CoinGecko prices`);
    } catch (e) {
        console.error('[PriceRefresher] CoinGecko fetch error:', e);
    }

    return prices;
}

/**
 * Batch fetch prices from DexScreener.
 * Takes up to 30 contract addresses.
 * Returns a map of CA -> price.
 */
async function batchFetchDexScreenerPrices(cas: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    if (cas.length === 0) return prices;

    // DexScreener supports comma-separated addresses (up to 30)
    const chunks: string[][] = [];
    for (let i = 0; i < cas.length; i += 30) {
        chunks.push(cas.slice(i, i + 30));
    }

    for (const chunk of chunks) {
        try {
            const url = `${DEXSCREENER_BASE}/tokens/${chunk.join(',')}`;
            console.log(`[PriceRefresher] Fetching ${chunk.length} DexScreener prices...`);

            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) {
                console.error(`[PriceRefresher] DexScreener error: ${res.status}`);
                continue;
            }

            const data = await res.json();

            if (data.pairs) {
                // Group by base token address and take highest liquidity pair
                const byToken = new Map<string, any>();
                for (const pair of data.pairs) {
                    const addr = pair.baseToken?.address;
                    if (!addr) continue;

                    const existing = byToken.get(addr);
                    if (!existing || (pair.liquidity?.usd || 0) > (existing.liquidity?.usd || 0)) {
                        byToken.set(addr, pair);
                    }
                }

                for (const [addr, pair] of byToken) {
                    if (pair.priceUsd) {
                        prices.set(addr, parseFloat(pair.priceUsd));
                    }
                }
            }
        } catch (e) {
            console.error('[PriceRefresher] DexScreener fetch error:', e);
        }
    }

    console.log(`[PriceRefresher] Got ${prices.size} DexScreener prices`);
    return prices;
}

/**
 * Main refresh function.
 * Fetches all active analyses, updates prices, and saves back.
 */
export async function refreshAllAnalyses(): Promise<RefreshResult> {
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
        token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
    });

    const result: RefreshResult = { updated: 0, errors: 0, skipped: 0 };

    try {
        // 1. Collect all analyses from recent_analyses
        const recentData = await redis.lrange('recent_analyses', 0, -1);
        const analyses: StoredAnalysis[] = recentData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        console.log(`[PriceRefresher] Processing ${analyses.length} analyses...`);

        if (analyses.length === 0) {
            return result;
        }

        // 2. Collect unique symbols and CAs
        const symbolsToFetch = new Set<string>();
        const casToFetch = new Set<string>();
        const analysisMap = new Map<string, StoredAnalysis>(); // id -> analysis

        for (const a of analyses) {
            analysisMap.set(a.id, a);

            // Determine if this is a CA-based token or symbol-based
            if (a.symbol && !COINGECKO_IDS[a.symbol.toUpperCase()]) {
                // Not in CoinGecko, might need DexScreener
                // But we need the CA. Check if stored? 
                // For now, skip if no CA info available
                // TODO: Store CA in StoredAnalysis for refresh
            } else if (a.symbol) {
                symbolsToFetch.add(a.symbol.toUpperCase());
            }
        }

        // Note: We don't have CA stored in StoredAnalysis currently.
        // For now, we'll refresh CoinGecko-listed tokens only.
        // TODO: Extend StoredAnalysis to include contractAddress for full refresh.

        // 3. Batch fetch prices
        const cgPrices = await batchFetchCoinGeckoPrices([...symbolsToFetch]);

        // 4. Update analyses
        const updatedAnalyses: StoredAnalysis[] = [];
        const affectedUsers = new Set<string>();

        for (const a of analyses) {
            const symbol = a.symbol?.toUpperCase();
            const newPrice = symbol ? cgPrices.get(symbol) : null;

            if (newPrice && a.entryPrice) {
                const oldPerf = a.performance;
                const newPerf = calculatePerformance(a.entryPrice, newPrice, a.sentiment);
                const newIsWin = newPerf > 0;

                // Only update if price actually changed
                if (a.currentPrice !== newPrice) {
                    a.currentPrice = newPrice;
                    a.performance = newPerf;
                    a.isWin = newIsWin;
                    result.updated++;
                    affectedUsers.add(a.username.toLowerCase());

                    console.log(`[PriceRefresher] ${a.symbol}: $${a.currentPrice?.toFixed(4)} -> $${newPrice.toFixed(4)} (${oldPerf.toFixed(2)}% -> ${newPerf.toFixed(2)}%)`);
                } else {
                    result.skipped++;
                }
            } else {
                result.skipped++;
            }

            updatedAnalyses.push(a);
        }

        // 5. Write back to recent_analyses
        if (result.updated > 0) {
            await redis.del('recent_analyses');
            // Push in reverse order (oldest first, then lpush reverses to correct order)
            for (let i = updatedAnalyses.length - 1; i >= 0; i--) {
                await redis.lpush('recent_analyses', JSON.stringify(updatedAnalyses[i]));
            }

            // 6. Update user histories and recalculate profiles
            for (const username of affectedUsers) {
                const historyKey = `user:history:${username}`;
                const historyData = await redis.lrange(historyKey, 0, -1);
                const history: StoredAnalysis[] = historyData.map((item: any) =>
                    typeof item === 'string' ? JSON.parse(item) : item
                );

                let historyUpdated = false;
                for (const h of history) {
                    const updated = updatedAnalyses.find(u => u.id === h.id);
                    if (updated) {
                        h.currentPrice = updated.currentPrice;
                        h.performance = updated.performance;
                        h.isWin = updated.isWin;
                        historyUpdated = true;
                    }
                }

                if (historyUpdated) {
                    await redis.del(historyKey);
                    for (let i = history.length - 1; i >= 0; i--) {
                        await redis.lpush(historyKey, JSON.stringify(history[i]));
                    }
                    await recalculateUserProfile(username);
                }
            }
        }

        console.log(`[PriceRefresher] Complete: ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`);

    } catch (e) {
        console.error('[PriceRefresher] Fatal error:', e);
        result.errors++;
    }

    return result;
}
