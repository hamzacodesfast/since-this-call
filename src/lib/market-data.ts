
import YahooFinance from 'yahoo-finance2';

// Check documentation before changing: https://github.com/gadicc/yahoo-finance2
const yahooFinance = new YahooFinance();

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
 * Fetches Stock data (Historical & Current) via Yahoo Finance v3.
 * Uses `chart` endpoint for history to avoid deprecated `historical` API issues.
 */
async function getYahooPrice(symbol: string, date?: Date): Promise<number | null> {
    try {
        if (date) {
            // HISTORICAL
            const from = date;
            const to = new Date(date);
            to.setDate(to.getDate() + 3); // 3-day wide window to ensure we catch a trading day (skip weekends)

            // console.log(`[MarketData] Yahoo History: ${symbol} from ${from.toISOString()}`);

            const result = await yahooFinance.chart(symbol, {
                period1: from,
                period2: to,
                interval: '1d'
            });

            if (result && result.quotes && result.quotes.length > 0) {
                return result.quotes[0].close;
            } else {
                console.warn(`[MarketData] Yahoo: No history for ${symbol} around ${from.toISOString()}`);
            }

        } else {
            // CURRENT PRICE
            const quote = await yahooFinance.quote(symbol);
            if (quote && quote.regularMarketPrice) {
                return quote.regularMarketPrice;
            }
        }
    } catch (e: any) {
        console.error('[MarketData] Yahoo Finance Error:', e.message);
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
            if (!coinId) return null;

            const d = date.getDate().toString().padStart(2, '0');
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const y = date.getFullYear();
            const dateParam = `${d}-${m}-${y}`;

            const url = `${COINGECKO_API}/coins/${coinId}/history?date=${dateParam}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.market_data && data.market_data.current_price) {
                return data.market_data.current_price.usd;
            }
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
