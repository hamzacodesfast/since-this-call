
import { unstable_noStore as noStore } from 'next/cache';

const YAHOO_BASE = 'https://query2.finance.yahoo.com/v8/finance/chart';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// Known contract addresses for tokens with fake/imposter pairs
const KNOWN_CAS: Record<string, { ca: string, chainId: string }> = {
    'ME': { ca: 'MEFNBXixkEbait3xn9bkm8WsJzXtVsaJEn4c8Sam21u', chainId: 'solana' }, // Magic Eden
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
};

export async function getPrice(symbol: string, type: 'CRYPTO' | 'STOCK', date?: Date): Promise<number | null> {
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

        // 2. Try CoinGecko (reliable for most listed tokens)
        const coinGeckoId = COINGECKO_IDS[symbol.toUpperCase()];
        if (coinGeckoId) {
            console.log(`[MarketData] Trying CoinGecko for ${symbol} (${coinGeckoId})...`);
            const cgPrice = await getCoinGeckoPrice(coinGeckoId, date);
            if (cgPrice !== null) return cgPrice;
        }

        // 3. Check if we have a known CA for this symbol
        const knownToken = KNOWN_CAS[symbol.toUpperCase()];
        if (knownToken) {
            console.log(`[MarketData] Using known CA for ${symbol}: ${knownToken.ca}`);
            const data = await getPriceByContractAddress(knownToken.ca);
            if (data) return data.price;
        }

        // 4. Fallback: DexScreener Search (Generic)
        console.log(`[MarketData] Yahoo/CoinGecko failed for ${symbol}, trying DexScreener Search...`);
        // Sanitize symbol (e.g. "67/SOL" -> "67", "$67" -> "67")
        const cleanSymbol = symbol.split('/')[0].replace(/^[$]/, '').trim();
        const result = await searchDexScreenerCA(cleanSymbol);
        if (result) {
            console.log(`[MarketData] Found Pair for ${symbol}: ${result.pairAddress} on ${result.chainId}`);

            // 5. Try High-Precision GeckoTerminal OHLCV (1-5 min)
            const precisePrice = await getGeckoTerminalPrice(result.chainId, result.pairAddress, date);
            if (precisePrice !== null) {
                console.log(`[MarketData] Used GeckoTerminal Precision Price: ${precisePrice}`);
                return precisePrice;
            }

            // 6. Default DexScreener Estimation (h1/h6/h24 buckets)
            return getDexPriceWithHistory(result, date); // Use Token Address (via result obj)
        }
    } else {
        return getYahooPrice(symbol, date);
    }

    return null;
}

// CoinGecko API - reliable for listed tokens
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
            const diffDays = Math.ceil((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays > 365) {
                console.log(`[CoinGecko] Date too old for historical data: ${diffDays} days ago`);
                return null;
            }

            // market_chart gives us historical prices
            const days = Math.min(diffDays + 1, 365);
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
            let closestPrice = null;
            let minDiff = Infinity;

            for (const [timestamp, price] of data.prices) {
                const diff = Math.abs(timestamp - targetTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestPrice = price;
                }
            }

            if (closestPrice !== null) {
                console.log(`[CoinGecko] Historical price for ${coinId}: $${closestPrice}`);
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

async function getGeckoTerminalPrice(chainId: string, poolAddress: string, date?: Date): Promise<number | null> {
    const network = GT_NETWORKS[chainId];
    if (!network || !date) return null; // Can't do precise history without supported net or date

    try {
        const targetTime = Math.floor(date.getTime() / 1000);
        const now = Math.floor(Date.now() / 1000);
        const diffHours = (now - targetTime) / 3600;

        // Strategy: 
        // < 24h: Try Minute candles (limit 1000 covers ~16h, maybe enough?)
        // > 24h: Try Hour candles

        let timeframe = 'minute';
        let limit = 1000;
        let aggregate = 1;

        if (diffHours > 16) {
            timeframe = 'hour';
            limit = 168; // 1 week coverage
        }

        const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}`;

        const res = await fetch(url, { cache: 'no-store' } as any);
        if (!res.ok) return null; // Rate limit or 404

        const json = await res.json();
        const candles = json?.data?.attributes?.ohlcv_list; // [[time, open, high, low, close, vol], ...]

        if (!candles || candles.length === 0) return null;

        // Find closest candle
        let closestPrice = null;
        let minDiff = Infinity;

        for (const c of candles) {
            const t = c[0];
            const close = c[4];
            const diff = Math.abs(t - targetTime);

            if (diff < minDiff) {
                minDiff = diff;
                closestPrice = close;
            }
        }

        // Acceptable tolerance?
        // For minute candles: within 15 mins?
        // For hour candles: within 2 hours?
        // Currently just taking best match.
        // If best match is > 24h away, maybe reject?
        // Let's rely on finding *something* better than h24 est.

        return closestPrice;

    } catch (e) {
        console.warn(`[MarketData] GT fetch failed:`, e);
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
                    const res = await fetch(url, { cache: 'no-store' });
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
                } catch (e) { }
            }

            // Fallback to Daily
            period1 = Math.floor(date.getTime() / 1000);
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
        const res = await fetch(url, { cache: 'no-store' });

        if (!res.ok) return null;

        const json = await res.json();
        const result = json?.chart?.result?.[0];

        if (!result) return null;

        const quotes = result.indicators?.quote?.[0];

        if (quotes && quotes.close && quotes.close.length > 0) {
            const validCloses = quotes.close.filter((p: number | null) => p !== null);
            if (validCloses.length > 0) {
                if (!date && result.meta && result.meta.regularMarketPrice) {
                    return result.meta.regularMarketPrice;
                }
                return date ? validCloses[0] : validCloses[validCloses.length - 1];
            }
        }
    } catch (e: any) {
        console.error('[MarketData] Yahoo Finance Fetch Error:', e.message);
    }
    return null;
}
