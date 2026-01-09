
// Removed yahoo-finance2 to ensure Vercel Edge Runtime compatibility
// using direct fetch to Yahoo Finance unofficial API (standard practice for zero-cost)

interface MarketData {
    symbol: string;
    price: number;
    date: string;
    currency: string;
}

export interface AssetPerformance {
    symbol: string;
    type: 'CRYPTO' | 'STOCK';
    callDate: string;
    callPrice: number;
    currentPrice: number;
    percentChange: number;
}


const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const BINANCE_API = 'https://api.binance.com/api/v3';
const YAHOO_BASE = 'https://query2.finance.yahoo.com/v8/finance/chart';

/**
 * Resolves a ticker symbol to a CoinGecko ID.
 * Uses a hardcoded map for speed/stability, falls back to search API.
 */
async function getCoinId(symbol: string): Promise<string | null> {
    const normalized = symbol.toLowerCase();

    // Hardcoded constants for stability & performance
    const COMMON_MAP: Record<string, string> = {
        'btc': 'bitcoin',
        'eth': 'ethereum',
        'sol': 'solana',
        'doge': 'dogecoin',
        'dot': 'polkadot',
        'ada': 'cardano',
        'xrp': 'ripple',
        'link': 'chainlink',
        'avax': 'avalanche-2',
        'matic': 'matic-network',
        'shib': 'shiba-inu',
        'bonk': 'bonk',
        'pepe': 'pepe'
    };

    if (COMMON_MAP[normalized]) return COMMON_MAP[normalized];

    // Fallback: Search API (Rate Limited)
    try {
        const res = await fetch(`${COINGECKO_API}/search?query=${normalized}`);
        const data = await res.json();
        if (data.coins && data.coins.length > 0) {
            // Prefer exact symbol match
            const exact = data.coins.find((c: any) => c.symbol.toLowerCase() === normalized);
            return exact ? exact.id : data.coins[0].id;
        }
    } catch (e) {
        console.error('[MarketData] CoinGecko Search Error:', e);
    }

    return null;
}

/**
 * Fetches historical crypto price from Binance Klines.
 * Primary source for historical data due to depth and uptime.
 */
async function getBinanceHistoricalPrice(symbol: string, date: Date): Promise<number | null> {
    try {
        const pair = `${symbol.toUpperCase()}USDT`;
        const startTime = date.getTime();

        // Limit 1 candle at daily interval starting from the specific time
        const url = `${BINANCE_API}/klines?symbol=${pair}&interval=1d&startTime=${startTime}&limit=1`;

        const res = await fetch(url);
        if (!res.ok) {
            // Not a hard error, pair might just not exist on Binance
            return null;
        }

        const data = await res.json();
        // Binance Kline format: [Open time, Open, High, Low, Close, Volume, ...]
        if (Array.isArray(data) && data.length > 0) {
            return parseFloat(data[0][4]); // Close Price
        }
    } catch (error) {
        console.error('[MarketData] Binance Fetch Error:', error);
    }
    return null;
}

/**
 * Fetches Stock data (Historical & Current) via Yahoo Finance v8 API (Fetch).
 * Compatible with Edge Runtime.
 */
async function getYahooPrice(symbol: string, date?: Date): Promise<number | null> {
    try {
        let period1 = 0;
        let period2 = 9999999999;

        if (date) {
            // Historical Window: Date -> Date + 3 days (to catch weekends/holidays)
            period1 = Math.floor(date.getTime() / 1000);
            const to = new Date(date);
            to.setDate(to.getDate() + 4);
            period2 = Math.floor(to.getTime() / 1000);
        } else {
            // Current Price: Look at last 2 days to ensure we get a quote
            const now = new Date();
            period2 = Math.floor(now.getTime() / 1000);
            const from = new Date(now);
            from.setDate(from.getDate() - 5);
            period1 = Math.floor(from.getTime() / 1000);
        }

        const url = `${YAHOO_BASE}/${symbol}?period1=${period1}&period2=${period2}&interval=1d&events=history`;
        // console.log(`[MarketData] Fetching: ${url}`);

        const res = await fetch(url);
        if (!res.ok) {
            // console.warn(`[MarketData] Yahoo Fetch failed: ${res.status}`);
            return null;
        }

        const json = await res.json();
        const result = json?.chart?.result?.[0];

        if (!result) return null;

        const quotes = result.indicators?.quote?.[0];

        if (quotes && quotes.close && quotes.close.length > 0) {
            // For historical, get the LAST price in the window? 
            // Actually, we want the price CLOSEST to the start date.
            // Since we set period1 to the date, the first element should be the correct day (or next trading day).

            // Filter out nulls (holidays)
            const validCloses = quotes.close.filter((p: number | null) => p !== null);

            if (validCloses.length > 0) {
                // If historical, we want the first valid close after the date.
                // If current, we want the last available closing price (or current price if live, but chart API gives closes).
                // API usually returns 'meta' with 'regularMarketPrice' for current
                if (!date && result.meta && result.meta.regularMarketPrice) {
                    return result.meta.regularMarketPrice;
                }

                // Fallback to chart data
                return date ? validCloses[0] : validCloses[validCloses.length - 1];
            }
        }
    } catch (e: any) {
        console.error('[MarketData] Yahoo Finance Fetch Error:', e.message);
    }
    return null;
}

/**
 * Fetches current price for meme coins/tokens via DexScreener.
 * Acts as a fallback for CoinGecko.
 */
async function getDexScreenerPrice(symbol: string): Promise<number | null> {
    try {
        // DexScreener search sorts by liquidity/volume by default
        const url = `https://api.dexscreener.com/latest/dex/search?q=${symbol}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.pairs && data.pairs.length > 0) {
            // Attempt to find loop for exact symbol match in baseToken
            const match = data.pairs.find((p: any) => p.baseToken.symbol.toUpperCase() === symbol.toUpperCase());
            const pair = match || data.pairs[0];

            if (pair) {
                // console.log(`[MarketData] DexScreener Found: ${pair.baseToken.symbol} @ $${pair.priceUsd}`);
                return parseFloat(pair.priceUsd);
            }
        }
    } catch (e) {
        console.error('[MarketData] DexScreener Error:', e);
    }
    return null;
}

/**
 * Main entry point for price data.
 * Routes to appropriate provider based on Asset Type and Date needs.
 */
export async function getPrice(symbol: string, type: 'CRYPTO' | 'STOCK', date?: Date): Promise<number | null> {
    // 1. Stocks -> Yahoo Finance (One-stop shop)
    if (type === 'STOCK') {
        return getYahooPrice(symbol, date);
    }

    // 2. Crypto Logic
    try {
        if (date) {
            // HISTORICAL CRYPTO

            // Primary: Binance (Best availability)
            const binancePrice = await getBinanceHistoricalPrice(symbol, date);
            if (binancePrice !== null) return binancePrice;

            // Secondary: CoinGecko (Free tier limitations apply)
            const coinId = await getCoinId(symbol);
            if (coinId) {
                const d = date.getDate().toString().padStart(2, '0');
                const m = (date.getMonth() + 1).toString().padStart(2, '0');
                const y = date.getFullYear();
                const dateParam = `${d}-${m}-${y}`;

                const url = `${COINGECKO_API}/coins/${coinId}/history?date=${dateParam}`;
                try {
                    const res = await fetch(url);
                    const data = await res.json();

                    if (data.market_data && data.market_data.current_price) {
                        return data.market_data.current_price.usd;
                    }
                } catch (e) {
                    console.error('[MarketData] CoinGecko History Error:', e);
                }
            }

            // Tertiary: Yahoo Finance (for major cryptos like BTC-USD, ETH-USD)
            const yahooSymbol = `${symbol.toUpperCase()}-USD`;
            const yahooPrice = await getYahooPrice(yahooSymbol, date);
            if (yahooPrice !== null) return yahooPrice;
        } else {
            // CURRENT CRYPTO PRICE

            // Primary: CoinGecko
            const coinId = await getCoinId(symbol);
            if (coinId) {
                const res = await fetch(`${COINGECKO_API}/simple/price?ids=${coinId}&vs_currencies=usd`);
                const data = await res.json();
                if (data[coinId] && data[coinId].usd) {
                    return data[coinId].usd;
                }
            }

            // Fallback: DexScreener (Essential for Meme Coins missing on Gecko)
            console.log(`[MarketData] Falling back to DexScreener for ${symbol}`);
            return await getDexScreenerPrice(symbol);
        }
    } catch (error) {
        console.error('[MarketData] General Error:', error);
    }
    return null;
}

export function calculatePerformance(callPrice: number, currentPrice: number): number {
    if (callPrice === 0) return 0;
    return ((currentPrice - callPrice) / callPrice) * 100;
}
