import { Redis } from '@upstash/redis';
import { StoredAnalysis, recalculateUserProfile } from './analysis-store';
import { calculatePerformance } from './market-data';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest/dex';

// CoinGecko ID mapping (same as market-data.ts)
const COINGECKO_IDS: Record<string, string> = {
    // Major Crypto
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
    'TON': 'the-open-network',
    'TRX': 'tron',
    'UNI': 'uniswap',
    'ATOM': 'cosmos',
    'APT': 'aptos',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'SUI': 'sui',
    // L1s & L2s
    'NEAR': 'near',
    'SEI': 'sei-network',
    'INJ': 'injective-protocol',
    'FTM': 'fantom',
    'ALGO': 'algorand',
    'ICP': 'internet-computer',
    'FIL': 'filecoin',
    'HBAR': 'hedera-hashgraph',
    'VET': 'vechain',
    'GAS': 'gas',
    // Meme & Trending
    'PEPE': 'pepe',
    'SHIB': 'shiba-inu',
    'HYPE': 'hyperliquid',
    'WIF': 'dogwifcoin',
    'BONK': 'bonk',
    'FLOKI': 'floki',
    'TRUMP': 'official-trump',
    'PENGU': 'pudgy-penguins',
    'FARTCOIN': 'fartcoin',
    'SPX6900': 'spx6900',
    // DeFi & Gaming
    'AAVE': 'aave',
    'CRV': 'curve-dao-token',
    'GALA': 'gala',
    'AXS': 'axie-infinity',
    'SAND': 'the-sandbox',
    'MANA': 'decentraland',
    'IMX': 'immutable-x',
    'ENS': 'ethereum-name-service',
    // AI & Data
    'AI16Z': 'ai16z',
    'VIRTUAL': 'virtual-protocol',
    'RENDER': 'render-token',
    'FET': 'fetch-ai',
    'RNDR': 'render-token',
    'TAO': 'bittensor',
    // Misc
    'AURA': 'aura-finance',
    'LIT': 'litentry',
    'ASTER': 'aster-2',
    'JUP': 'jupiter-exchange-solana',
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

const YAHOO_BASE = 'https://query2.finance.yahoo.com/v8/finance/chart';

/**
 * Batch fetch stock prices from Yahoo Finance.
 * Returns a map of symbol -> price.
 */
async function batchFetchYahooPrices(symbols: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    if (symbols.length === 0) return prices;

    console.log(`[PriceRefresher] Fetching ${symbols.length} Yahoo prices...`);

    // Yahoo doesn't have a true batch endpoint, so we fetch concurrently
    const promises = symbols.map(async (symbol) => {
        try {
            const url = `${YAHOO_BASE}/${symbol}?interval=1d&range=1d`;
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return;

            const json = await res.json();
            const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (price) {
                prices.set(symbol.toUpperCase(), price);
            }
        } catch (e) {
            // Silently skip failed symbols
        }
    });

    await Promise.all(promises);
    console.log(`[PriceRefresher] Got ${prices.size} Yahoo prices`);
    return prices;
}

/**
 * Main refresh function.
 * Fetches ALL analyses from ALL user histories, updates prices, and saves back.
 * Also updates recent_analyses for any matching entries.
 * Supports: CoinGecko crypto, DexScreener tokens, and Yahoo stocks.
 */
export async function refreshAllAnalyses(): Promise<RefreshResult> {
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
        token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
    });

    const result: RefreshResult = { updated: 0, errors: 0, skipped: 0 };

    try {
        // 1. Get all usernames from the set
        const allUsernames = await redis.smembers('all_users') as string[];
        console.log(`[PriceRefresher] Found ${allUsernames.length} users to process`);

        // 2. Collect ALL analyses from ALL user histories
        const allAnalysesMap = new Map<string, { analysis: StoredAnalysis; username: string }>();

        for (const username of allUsernames) {
            const historyKey = `user:history:${username}`;
            const historyData = await redis.lrange(historyKey, 0, -1);
            const history: StoredAnalysis[] = historyData.map((item: any) =>
                typeof item === 'string' ? JSON.parse(item) : item
            );

            for (const a of history) {
                if (a.id && !allAnalysesMap.has(a.id)) {
                    allAnalysesMap.set(a.id, { analysis: a, username });
                }
            }
        }

        const allAnalyses = Array.from(allAnalysesMap.values()).map(x => x.analysis);
        console.log(`[PriceRefresher] Processing ${allAnalyses.length} unique analyses across all profiles...`);

        if (allAnalyses.length === 0) {
            return result;
        }

        // 3. Categorize analyses by data source
        const cgSymbols = new Set<string>();
        const yahooSymbols = new Set<string>();
        const dexCAs = new Set<string>();

        for (const a of allAnalyses) {
            const symbol = a.symbol?.toUpperCase();

            if (a.type === 'STOCK') {
                if (symbol) yahooSymbols.add(symbol);
            } else if (a.contractAddress) {
                dexCAs.add(a.contractAddress);
            } else if (symbol && COINGECKO_IDS[symbol]) {
                cgSymbols.add(symbol);
            }
        }

        // 4. Batch fetch prices from all sources
        const [cgPrices, yahooPrices, dexPrices] = await Promise.all([
            batchFetchCoinGeckoPrices([...cgSymbols]),
            batchFetchYahooPrices([...yahooSymbols]),
            batchFetchDexScreenerPrices([...dexCAs]),
        ]);

        // 5. Update analyses and track which were updated
        const updatedAnalysesById = new Map<string, StoredAnalysis>();
        const affectedUsers = new Set<string>();

        for (const a of allAnalyses) {
            const symbol = a.symbol?.toUpperCase();
            let newPrice: number | null = null;

            if (a.type === 'STOCK' && symbol) {
                newPrice = yahooPrices.get(symbol) || null;
            } else if (a.contractAddress) {
                newPrice = dexPrices.get(a.contractAddress) || null;
            } else if (symbol && COINGECKO_IDS[symbol]) {
                newPrice = cgPrices.get(symbol) || null;
            }

            if (newPrice && a.entryPrice) {
                const oldPerf = a.performance;
                const newPerf = calculatePerformance(a.entryPrice, newPrice, a.sentiment);
                const newIsWin = newPerf > 0;

                if (a.currentPrice !== newPrice) {
                    const oldPrice = a.currentPrice;
                    a.currentPrice = newPrice;
                    a.performance = newPerf;
                    a.isWin = newIsWin;
                    result.updated++;
                    updatedAnalysesById.set(a.id, a);
                    affectedUsers.add(a.username.toLowerCase());

                    const badgeFlip = (oldPerf > 0) !== (newPerf > 0);
                    const source = a.type === 'STOCK' ? 'Yahoo' : a.contractAddress ? 'DexScreener' : 'CoinGecko';
                    console.log(`[PriceRefresher] ${a.symbol} (${source}): $${oldPrice?.toFixed(4)} -> $${newPrice.toFixed(4)} (${oldPerf.toFixed(2)}% -> ${newPerf.toFixed(2)}%)${badgeFlip ? ' 🔄 BADGE FLIP!' : ''}`);
                } else {
                    result.skipped++;
                }
            } else {
                result.skipped++;
                if (!a.entryPrice) {
                    console.log(`[PriceRefresher] SKIP ${a.symbol}: no entryPrice`);
                } else if (!newPrice) {
                    const reason = a.type === 'STOCK'
                        ? 'not found in Yahoo'
                        : a.contractAddress
                            ? 'not found in DexScreener'
                            : COINGECKO_IDS[symbol || '']
                                ? 'CoinGecko API error'
                                : 'no price source (not in CoinGecko, no CA)';
                    console.log(`[PriceRefresher] SKIP ${a.symbol}: ${reason}`);
                }
            }
        }

        // 6. Write back to user histories and recalculate profiles
        for (const username of affectedUsers) {
            const historyKey = `user:history:${username}`;
            const historyData = await redis.lrange(historyKey, 0, -1);
            const history: StoredAnalysis[] = historyData.map((item: any) =>
                typeof item === 'string' ? JSON.parse(item) : item
            );

            let historyUpdated = false;
            for (const h of history) {
                const updated = updatedAnalysesById.get(h.id);
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

        // 7. Also update recent_analyses if any entries there were updated
        const recentData = await redis.lrange('recent_analyses', 0, -1);
        const recentAnalyses: StoredAnalysis[] = recentData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        let recentUpdated = false;
        for (const r of recentAnalyses) {
            const updated = updatedAnalysesById.get(r.id);
            if (updated) {
                r.currentPrice = updated.currentPrice;
                r.performance = updated.performance;
                r.isWin = updated.isWin;
                recentUpdated = true;
            }
        }

        if (recentUpdated) {
            await redis.del('recent_analyses');
            for (let i = recentAnalyses.length - 1; i >= 0; i--) {
                await redis.lpush('recent_analyses', JSON.stringify(recentAnalyses[i]));
            }
        }

        console.log(`[PriceRefresher] Complete: ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`);

    } catch (e) {
        console.error('[PriceRefresher] Fatal error:', e);
        result.errors++;
    }

    return result;
}

