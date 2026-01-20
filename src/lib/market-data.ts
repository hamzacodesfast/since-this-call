
import { unstable_noStore as noStore } from 'next/cache';

const YAHOO_BASE = 'https://query2.finance.yahoo.com/v8/finance/chart';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// Known contract addresses for tokens with fake/imposter pairs
const KNOWN_CAS: Record<string, { ca: string, chainId: string }> = {
    'ME': { ca: 'MEFNBXixkEbait3xn9bkm8WsJzXtVsaJEn4c8Sam21u', chainId: 'solana' }, // Magic Eden
    'PUMP': { ca: 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn', chainId: 'solana' }, // Pump.fun
};

// CoinGecko ID mapping for common tokens
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
    'UNI': 'uniswap',
    'ATOM': 'cosmos',
    'NEAR': 'near',
    'APT': 'aptos',
    'SUI': 'sui',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'PEPE': 'pepe',
    'SHIB': 'shiba-inu',
    'HYPE': 'hyperliquid',
    'ME': 'magic-eden',
    'PENGU': 'pudgy-penguins',
    'WIF': 'dogwifcoin',
    'BONK': 'bonk',
    'JUP': 'jupiter-exchange-solana',
    'RENDER': 'render-token',
    'FET': 'fetch-ai',
    'INJ': 'injective-protocol',
    'TIA': 'celestia',
    'SEI': 'sei-network',
    'ONDO': 'ondo-finance',
    'PYTH': 'pyth-network',
    'JTO': 'jito-governance-token',
    'AAVE': 'aave',
    'MKR': 'maker',
    'CRV': 'curve-dao-token',
    'LDO': 'lido-dao',
    'RUNE': 'thorchain',
    'FTM': 'fantom',
    'MANA': 'decentraland',
    'SAND': 'the-sandbox',
    'AXS': 'axie-infinity',
    'GALA': 'gala',
    'IMX': 'immutable-x',
    'BLUR': 'blur',
    'ENS': 'ethereum-name-service',
    'APE': 'apecoin',
    'CAKE': 'pancakeswap-token',
    'GMT': 'stepn',
    'FLOW': 'flow',
    'EGLD': 'elrond-erd-2',
    'XLM': 'stellar',
    'ALGO': 'algorand',
    'FIL': 'filecoin',
    'VET': 'vechain',
    'HBAR': 'hedera-hashgraph',
    'ICP': 'internet-computer',
    'KAVA': 'kava',
    'XTZ': 'tezos',
    'EOS': 'eos',
    'THETA': 'theta-token',
    'ZIL': 'zilliqa',
    'KCS': 'kucoin-shares',
    'NEO': 'neo',
    'ONE': 'harmony',
    'QTUM': 'qtum',
    'ZRX': '0x',
    'BAT': 'basic-attention-token',
    'COMP': 'compound-governance-token',
    'SNX': 'havven',
    'YFI': 'yearn-finance',
    'SUSHI': 'sushi',
    '1INCH': '1inch',
    'GRT': 'the-graph',
    'FXS': 'frax-share',
    'CVX': 'convex-finance',
    'RPL': 'rocket-pool',
    'GMX': 'gmx',
    'DYDX': 'dydx',
    'SSV': 'ssv-network',
    'MAGIC': 'magic',
    'STX': 'blockstack',
    'MASK': 'mask-network',
    'OCEAN': 'ocean-protocol',
    'ROSE': 'oasis-network',
    'CELO': 'celo',
    'MINA': 'mina-protocol',
    'KSM': 'kusama',
    'WAVES': 'waves',
    'DASH': 'dash',
    'ZEC': 'zcash',
    'XMR': 'monero',
    'ETC': 'ethereum-classic',
    'BCH': 'bitcoin-cash',
    'TRX': 'tron',
    'TON': 'the-open-network',
    'AI16Z': 'ai16z',
    'FARTCOIN': 'fartcoin',
    'VIRTUAL': 'virtual-protocol',
    'AI': 'artificial-intelligence',
    'GOAT': 'goatseus-maximus',
    'SPX6900': 'spx6900',
    'ZEREBRO': 'zerebro',
    'ARC': 'arc',
    'AIXBT': 'aixbt',
    'GRIFFAIN': 'griffain',
    'SWARMS': 'swarms',
    'PUMP': 'pump-fun',
    'ASTER': 'aster-2',
};

// Launch dates and initial prices for major assets
const LAUNCH_DATES: Record<string, { date: Date, price: number }> = {
    'BTC': { date: new Date('2010-07-17'), price: 0.0008 },
    'ETH': { date: new Date('2015-08-07'), price: 2.77 },
    'SOL': { date: new Date('2020-03-16'), price: 0.22 },
    'DOGE': { date: new Date('2013-12-15'), price: 0.0002 },
};

export async function getPrice(symbol: string, type: 'CRYPTO' | 'STOCK', date?: Date): Promise<number | null> {
    // 0. Check for pre-market dates (before launch)
    if (date) {
        const launchData = LAUNCH_DATES[symbol.toUpperCase()];
        if (launchData && date < launchData.date) {
            console.log(`[MarketData] Date ${date.toISOString()} is before ${symbol} launch (${launchData.date.toISOString()}). Using launch price: $${launchData.price}`);
            return launchData.price;
        }
    }

    // 1. Try Yahoo Finance first (Best for Stocks & Major Crypto)
    if (type === 'CRYPTO') {
        const mapping: Record<string, string> = {
            'BTC': 'BTC-USD',
            'ETH': 'ETH-USD',
            'SOL': 'SOL-USD',
            'DOGE': 'DOGE-USD',
            'XRP': 'XRP-USD',
            'BNB': 'BNB-USD',
            'LTC': 'LTC-USD',
            'ZEC': 'ZEC-USD',
            'XMR': 'XMR-USD',
            'HYPE': 'HYPE32196-USD', // Hyperliquid
        };
        const yahooSymbol = mapping[symbol] || `${symbol}-USD`;
        const yahooPrice = await getYahooPrice(yahooSymbol, date);

        if (yahooPrice !== null) return yahooPrice;

        // 2. Try CoinMarketCap (Prioritized over CoinGecko)
        const cmcPrice = await getCoinMarketCapPrice(symbol, date);
        if (cmcPrice !== null) {
            console.log(`[MarketData] Used CoinMarketCap for ${symbol}: $${cmcPrice}`);
            return cmcPrice;
        }

        // 3. Try CoinGecko (reliable for most listed tokens)
        const coinGeckoId = COINGECKO_IDS[symbol.toUpperCase()];
        if (coinGeckoId) {
            console.log(`[MarketData] Trying CoinGecko for ${symbol} (${coinGeckoId})...`);
            const cgPrice = await getCoinGeckoPrice(coinGeckoId, date);
            if (cgPrice !== null) return cgPrice;
        }

        // 4. Check if we have a known CA for this symbol
        const knownToken = KNOWN_CAS[symbol.toUpperCase()];
        if (knownToken) {
            console.log(`[MarketData] Using known CA for ${symbol}: ${knownToken.ca}`);
            const data = await getPriceByContractAddress(knownToken.ca);
            if (data) return data.price;
        }

        // 5. Fallback: DexScreener Search (Generic)
        console.log(`[MarketData] Yahoo/CMC/CoinGecko failed for ${symbol}, trying DexScreener Search...`);
        // Sanitize symbol (e.g. "67/SOL" -> "67", "$67" -> "67")
        const cleanSymbol = symbol.split('/')[0].replace(/^[$]/, '').trim();
        const result = await searchDexScreenerCA(cleanSymbol);
        if (result) {
            console.log(`[MarketData] Found Pair for ${symbol}: ${result.pairAddress} on ${result.chainId}`);

            // 6. Try High-Precision GeckoTerminal OHLCV (1-5 min)
            const precisePrice = await getGeckoTerminalPrice(result.chainId, result.pairAddress, date);
            if (precisePrice !== null) {
                console.log(`[MarketData] Used GeckoTerminal Precision Price: ${precisePrice}`);
                return precisePrice;
            }

            // 7. Default DexScreener Estimation (h1/h6/h24 buckets)
            return getDexPriceWithHistory(result, date); // Use Token Address (via result obj)
        }
    } else {
        // STOCK - Yahoo Finance only
        console.log(`[MarketData] Fetching stock price for ${symbol}...`);
        const stockPrice = await getYahooPrice(symbol, date);
        if (stockPrice === null) {
            console.log(`[MarketData] Yahoo Finance returned null for ${symbol}`);
        } else {
            console.log(`[MarketData] Yahoo price for ${symbol}: $${stockPrice}`);
        }
        return stockPrice;
    }

    return null;
}

const CMC_BASE = 'https://pro-api.coinmarketcap.com/v1'; // Or v2 depending on endpoint
// Note: Basic tier often doesn't have historical data, so we might fail gracefully back to CG

async function getCoinMarketCapPrice(symbol: string, date?: Date): Promise<number | null> {
    const apiKey = process.env.COINMARKETCAP_API_KEY;
    if (!apiKey) return null;

    try {
        const headers = {
            'X-CMC_PRO_API_KEY': apiKey,
            'Accept': 'application/json',
        };

        if (date) {
            // Historical Query (Check availability - implied endpoint)
            // Note: v2/cryptocurrency/quotes/historical is often paid-only.
            // We will Try it.
            // Need to convert date to ISO8601 or Unix
            // CMC historical takes 'date' query param? 
            // It actually uses /v1/cryptocurrency/quotes/historical usually? No, it's specific.
            // Let's assume for now we might skip historical if implementation is complex/paid, 
            // but let's try the common endpoint.
            // Actually, for free tier, historical is usually NOT available. 
            // Better strategy: Return null for historical so it falls back to CoinGecko (which enables free history).
            // UNLESS user has paid plan.

            // Let's try to fetch it, if 403/402, return null.
            // However, CoinGecko handles history famously well for free. 
            // Let's prioritizing CMC for *CURRENT* price primarily, and only try history if simple.

            // For this implementation, I will SKIP historical on CMC to ensure we use CoinGecko's verified free history
            // unless we are sure CMC works. The user said "prioritize CMC", but if CMC fails history, we must fallback.
            // I'll return null for date queries to let CoinGecko handle history for now, 
            // OR I can implement it and catch the error.
            return null;
        } else {
            // Current Price
            const url = `${CMC_BASE}/cryptocurrency/quotes/latest?symbol=${symbol}&convert=USD`;
            const res = await fetch(url, { headers, cache: 'no-store' } as any);
            if (!res.ok) {
                // console.log(`[CMC] API Error: ${res.status} ${res.statusText}`);
                return null;
            }
            const json = await res.json();
            // json.data[symbol] is an array or object? 
            // With ?symbol=BTC, data.BTC is an array of quote objects usually (handling duplicates).
            // We take the first one or the one with highest 'cmc_rank'.
            const data = json.data[symbol.toUpperCase()];
            if (Array.isArray(data) && data.length > 0) {
                // Sort by rank if possible, or take first
                // usually data[0] is the main one
                return data[0].quote.USD.price;
            } else if (data && data.quote) {
                // Sometimes it's a single object if unique? 
                // Documentation says it returns a map. `data: { "BTC": [ ... ] }`
                return data.quote.USD.price; // fallback if strictly single
            }

            // Handle array case specifically as per standard response
            if (Array.isArray(data)) {
                return data[0].quote.USD.price;
            }
        }

    } catch (e) {
        console.error('[CMC] Error:', e);
    }
    return null;
}

// CoinGecko API - reliable for listed tokens
// Granularity is AUTOMATIC based on days requested:
// - 1 day: 5-minute data
// - 2-90 days: HOURLY data
// - >90 days: Daily data
async function getCoinGeckoPrice(coinId: string, date?: Date): Promise<number | null> {
    const apiKey = process.env.COINGECKO_API_KEY;
    if (!apiKey) {
        console.log('[MarketData] No CoinGecko API key configured');
        return null;
    }

    try {
        const headers: Record<string, string> = {
            'x-cg-demo-api-key': apiKey,
            'Accept': 'application/json',
        };

        if (date) {
            // Historical price - use market_chart endpoint
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);

            if (diffDays > 365) {
                console.log(`[CoinGecko] Date too old for historical data: ${diffDays.toFixed(1)} days ago`);
                return null;
            }

            // Request optimal days for granularity:
            // - 2-90 days: CoinGecko auto-returns HOURLY data
            // - <1 day: Returns 5-min data (best!)
            // - >90 days: Only daily available
            let days = Math.ceil(diffDays) + 1;

            // Ensure minimum of 2 days to get hourly granularity for tweets 1-2 days old
            if (diffDays >= 1 && days < 2) {
                days = 2;
            }

            // Cap at 90 days to maintain hourly granularity
            days = Math.min(days, 90);

            const expectedGranularity = days <= 1 ? '5-min' : days <= 90 ? 'hourly' : 'daily';
            console.log(`[CoinGecko] Requesting ${days} days of data for ${coinId} (expecting ${expectedGranularity} granularity)`);

            const url = `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;

            const res = await fetch(url, {
                headers,
                cache: 'no-store'
            } as any);

            if (!res.ok) {
                console.log(`[CoinGecko] API error: ${res.status}`);
                return null;
            }

            const data = await res.json();
            if (!data.prices || data.prices.length === 0) return null;

            // Find closest price to target date
            const targetTime = date.getTime();

            // Sort prices by timestamp to ensure order
            const sortedPrices = [...data.prices].sort((a: any, b: any) => a[0] - b[0]);
            const oldestTimestamp = sortedPrices[0][0];
            const oldestPrice = sortedPrices[0][1];

            // Log data point count and interval for debugging
            if (sortedPrices.length >= 2) {
                const interval = (sortedPrices[1][0] - sortedPrices[0][0]) / (1000 * 60);
                console.log(`[CoinGecko] Got ${sortedPrices.length} data points, ~${interval.toFixed(0)}min intervals`);
            }

            // If target date is before the oldest data point, use the oldest price
            if (targetTime < oldestTimestamp) {
                console.log(`[CoinGecko] Target date ${date.toISOString()} is before listing. Using oldest available price: $${oldestPrice}`);
                return oldestPrice;
            }

            let closestPrice = null;
            let closestTimestamp = 0;
            let minDiff = Infinity;

            for (const [timestamp, price] of data.prices) {
                const diff = Math.abs(timestamp - targetTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestPrice = price;
                    closestTimestamp = timestamp;
                }
            }

            if (closestPrice !== null) {
                const deltaMinutes = Math.round(minDiff / (1000 * 60));
                const closestDate = new Date(closestTimestamp).toISOString();
                console.log(`[CoinGecko] Found $${closestPrice.toFixed(4)} at ${closestDate} (${deltaMinutes}min from tweet)`);
            }
            return closestPrice;
        } else {
            // Current price - use simple/price endpoint
            const url = `${COINGECKO_BASE}/simple/price?ids=${coinId}&vs_currencies=usd`;

            const res = await fetch(url, {
                headers,
                cache: 'no-store'
            } as any);

            if (!res.ok) {
                console.log(`[CoinGecko] API error: ${res.status}`);
                return null;
            }

            const data = await res.json();
            const price = data[coinId]?.usd;

            if (price !== undefined) {
                console.log(`[CoinGecko] Current price for ${coinId}: $${price}`);
                return price;
            }
        }
    } catch (e) {
        console.error('[CoinGecko] Error:', e);
    }
    return null;
}

// Map DexScreener chainId to GeckoTerminal networkId
const GT_NETWORKS: Record<string, string> = {
    'solana': 'solana',
    'ethereum': 'eth',
    'bsc': 'bsc',
    'base': 'base',
    'arbitrum': 'arbitrum',
    'polygon': 'polygon_pos',
    'optimism': 'optimism',
    'avalanche': 'avax',
};

/**
 * Get historical price from GeckoTerminal OHLCV candles.
 * Supports minute (up to 16h), hour (up to 7d), and day (up to 60d) timeframes.
 */
export async function getGeckoTerminalPrice(chainId: string, poolAddress: string, date?: Date): Promise<number | null> {
    const network = GT_NETWORKS[chainId];
    if (!network || !date) return null; // Can't do precise history without supported net or date

    try {
        const targetTime = Math.floor(date.getTime() / 1000);
        const now = Math.floor(Date.now() / 1000);
        const diffHours = (now - targetTime) / 3600;
        const diffDays = diffHours / 24;

        // Strategy: 
        // < 16h: Minute candles (limit 1000 covers ~16h)
        // 16h - 7d: Hour candles (limit 168 covers 7d)
        // 7d - 60d: Day candles (limit 60 covers 60d)

        let timeframe = 'minute';
        let limit = 1000;
        let aggregate = 1;

        if (diffDays > 7) {
            timeframe = 'day';
            limit = 60; // 60 days coverage
        } else if (diffHours > 16) {
            timeframe = 'hour';
            limit = 168; // 7 days coverage
        }

        const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}`;
        console.log(`[GeckoTerminal] Fetching ${timeframe} candles for ${poolAddress} (${diffDays.toFixed(1)} days ago)`);

        const res = await fetch(url, { cache: 'no-store' } as any);
        if (!res.ok) {
            console.log(`[GeckoTerminal] API error: ${res.status}`);
            return null;
        }

        const json = await res.json();
        const candles = json?.data?.attributes?.ohlcv_list; // [[time, open, high, low, close, vol], ...]

        if (!candles || candles.length === 0) {
            console.log(`[GeckoTerminal] No candles returned`);
            return null;
        }

        console.log(`[GeckoTerminal] Got ${candles.length} ${timeframe} candles`);

        // Find closest candle to target time
        let closestPrice = null;
        let closestTime = 0;
        let minDiff = Infinity;

        for (const c of candles) {
            const t = c[0];
            const close = c[4];
            const diff = Math.abs(t - targetTime);

            if (diff < minDiff) {
                minDiff = diff;
                closestPrice = close;
                closestTime = t;
            }
        }

        if (closestPrice !== null) {
            const closestDate = new Date(closestTime * 1000).toISOString();
            console.log(`[GeckoTerminal] Found price $${closestPrice} at ${closestDate} (${(minDiff / 3600).toFixed(1)}h from target)`);
        }

        return closestPrice;

    } catch (e) {
        console.warn(`[MarketData] GT fetch failed:`, e);
    }
    return null;
}

/**
 * Get pair info (chainId, pairAddress) from DexScreener by contract address.
 * This is needed to query GeckoTerminal for historical prices.
 */
export async function getPairInfoByCA(ca: string): Promise<{ chainId: string, pairAddress: string } | null> {
    try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, { cache: 'no-store' });
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
            // Sort by liquidity to get the most liquid (real) pair
            const sortedPairs = [...data.pairs].sort((a: any, b: any) =>
                (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
            );
            const pair = sortedPairs[0];
            return {
                chainId: pair.chainId,
                pairAddress: pair.pairAddress,
            };
        }
    } catch (e) {
        console.error('[MarketData] getPairInfoByCA Error:', e);
    }
    return null;
}




// Updating to return object
async function searchDexScreenerCA(symbol: string): Promise<{ baseTokenAddress: string, pairAddress: string, chainId: string } | null> {
    try {
        const url = `https://api.dexscreener.com/latest/dex/search/?q=${symbol}`;
        const res = await fetch(url, { cache: 'no-store' } as any);
        const json = await res.json();

        if (json.pairs && json.pairs.length > 0) {
            const matches = json.pairs.filter((p: any) => p.baseToken.symbol.toUpperCase() === symbol.toUpperCase());
            if (matches.length > 0) {
                matches.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
                const top = matches[0];
                return {
                    baseTokenAddress: top.baseToken.address,
                    pairAddress: top.pairAddress,
                    chainId: top.chainId
                };
            }
        }
    } catch (e) {
        console.error('[MarketData] Search failed:', e);
    }
    return null;
}

// Refactored Helper (formerly getDexPriceWithHistory)
async function getDexPriceWithHistory(result: any, date?: Date): Promise<number | null> {
    // result is { baseTokenAddress, pairAddress, chainId }
    // Or simpler: pass CA (baseTokenAddress)

    try {
        const ca = typeof result === 'string' ? result : result.baseTokenAddress;
        console.log(`[MarketData] getDexPriceWithHistory CA: ${ca}`);

        const data = await getPriceByContractAddress(ca);
        if (data) {
            if (date) {
                const now = new Date();
                const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

                if (diffHours <= 24 && data.priceChange && data.priceChange.h24 !== undefined) {
                    let change = 0;
                    if (diffHours <= 1) change = data.priceChange.h1;
                    else if (diffHours <= 6) change = data.priceChange.h6;
                    else change = data.priceChange.h24;

                    return data.price / (1 + change / 100);
                }
            }
            return data.price;
        } else {
            console.log(`[MarketData] getPriceByContractAddress returned null for ${ca}`);
        }
    } catch (e) {
        console.error('[MarketData] getDexPriceWithHistory Error:', e);
    }
    return null;
}

export async function getPriceByContractAddress(ca: string): Promise<any | null> {
    try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, { cache: 'no-store' });
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
            // Sort by liquidity to get the most liquid (real) pair
            const sortedPairs = [...data.pairs].sort((a: any, b: any) =>
                (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
            );
            const pair = sortedPairs[0];
            return {
                price: parseFloat(pair.priceUsd),
                symbol: pair.baseToken.symbol,
                name: pair.baseToken.name,
                liquidity: pair.liquidity?.usd,
                marketCap: pair.fdv,
                priceChange: pair.priceChange,
                pairCreatedAt: pair.pairCreatedAt,
            };
        }
    } catch (e) {
        console.error('DexScreener API Error:', e);
    }
    return null;
}

export function calculatePerformance(callPrice: number, currentPrice: number, sentiment: 'BULLISH' | 'BEARISH'): number {
    const rawChange = ((currentPrice - callPrice) / callPrice) * 100;
    if (sentiment === 'BEARISH') {
        return -rawChange;
    }
    return rawChange;
}

async function getYahooPrice(symbol: string, date?: Date): Promise<number | null> {
    try {
        let period1 = 0;
        let period2 = 9999999999;

        if (date) {
            const now = new Date();
            const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
            const targetTime = Math.floor(date.getTime() / 1000);

            let strategy: { interval: string, range: number } | null = null;

            if (diffDays < 7) {
                strategy = { interval: '1m', range: 1800 };
            } else if (diffDays < 55) {
                strategy = { interval: '5m', range: 7200 };
            } else if (diffDays < 700) {
                strategy = { interval: '1h', range: 86400 };
            }

            if (strategy) {
                const p1 = targetTime - strategy.range;
                const p2 = targetTime + strategy.range;
                const url = `${YAHOO_BASE}/${symbol}?period1=${p1}&period2=${p2}&interval=${strategy.interval}&events=history`;

                try {
                    const res = await fetch(url, {
                        cache: 'no-store',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    if (res.ok) {
                        const json = await res.json();
                        const result = json?.chart?.result?.[0];
                        const quotes = result?.indicators?.quote?.[0];
                        const timestamps = result?.timestamp;

                        if (timestamps && quotes && quotes.close && quotes.close.length > 0) {
                            let closestPrice = null;
                            let minDiff = Infinity;
                            for (let i = 0; i < timestamps.length; i++) {
                                const t = timestamps[i];
                                const diff = Math.abs(t - targetTime);
                                if (diff < minDiff && quotes.close[i] !== null) {
                                    minDiff = diff;
                                    closestPrice = quotes.close[i];
                                }
                            }
                            if (closestPrice !== null) return closestPrice;
                        }
                    }
                } catch (e: any) {
                    console.error(`[MarketData] Yahoo intraday fetch error for ${symbol}:`, e?.message || e);
                }
            }

            // Fallback to Daily - include previous day for pre-market tweets
            const from = new Date(date);
            from.setDate(from.getDate() - 1); // Start from day before tweet
            period1 = Math.floor(from.getTime() / 1000);
            const to = new Date(date);
            to.setDate(to.getDate() + 4);
            period2 = Math.floor(to.getTime() / 1000);
        } else {
            const now = new Date();
            period2 = Math.floor(now.getTime() / 1000);
            const from = new Date(now);
            from.setDate(from.getDate() - 5);
            period1 = Math.floor(from.getTime() / 1000);
        }

        const url = `${YAHOO_BASE}/${symbol}?period1=${period1}&period2=${period2}&interval=1d&events=history`;
        const res = await fetch(url, {
            cache: 'no-store',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!res.ok) return null;

        const json = await res.json();
        const result = json?.chart?.result?.[0];

        if (!result) return null;

        const quotes = result.indicators?.quote?.[0];

        if (quotes && quotes.close && quotes.close.length > 0) {
            const timestamps = result.timestamp;

            if (!date && result.meta && result.meta.regularMarketPrice) {
                return result.meta.regularMarketPrice;
            }

            if (date && timestamps && timestamps.length > 0) {
                // Find the closest candle AT or BEFORE the tweet time
                const targetTime = Math.floor(date.getTime() / 1000);
                let closestPrice = null;
                let closestTime = 0;

                for (let i = 0; i < timestamps.length; i++) {
                    const t = timestamps[i];
                    const price = quotes.close[i];
                    // Only consider candles before or at the tweet time
                    if (t <= targetTime && price !== null) {
                        if (t > closestTime) {
                            closestTime = t;
                            closestPrice = price;
                        }
                    }
                }

                if (closestPrice !== null) {
                    console.log(`[Yahoo] Found daily close $${closestPrice} at ${new Date(closestTime * 1000).toISOString()} for tweet at ${date.toISOString()}`);
                    return closestPrice;
                }

                // If no candle before tweet, use the first available (shouldn't happen often)
                const validCloses = quotes.close.filter((p: number | null) => p !== null);
                if (validCloses.length > 0) return validCloses[0];
            } else {
                // Current price - get most recent
                const validCloses = quotes.close.filter((p: number | null) => p !== null);
                if (validCloses.length > 0) return validCloses[validCloses.length - 1];
            }
        }
    } catch (e: any) {
        console.error('[MarketData] Yahoo Finance Fetch Error:', e.message);
    }
    return null;
}
