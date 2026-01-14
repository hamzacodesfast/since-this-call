
import { unstable_noStore as noStore } from 'next/cache';

const YAHOO_BASE = 'https://query2.finance.yahoo.com/v8/finance/chart';

export async function getPrice(symbol: string, type: 'CRYPTO' | 'STOCK', date?: Date): Promise<number | null> {
    if (type === 'CRYPTO') {
        // Map common symbols to Yahoo format
        const mapping: Record<string, string> = {
            'BTC': 'BTC-USD',
            'ETH': 'ETH-USD',
            'SOL': 'SOL-USD',
            'DOGE': 'DOGE-USD',
            'XRP': 'XRP-USD',
            'BNB': 'BNB-USD',
            'DASH': 'DASH-USD',
            'LTC': 'LTC-USD',
            'ZEC': 'ZEC-USD',
            'XMR': 'XMR-USD',
        };
        const yahooSymbol = mapping[symbol] || `${symbol}-USD`;
        return getYahooPrice(yahooSymbol, date);
    } else {
        return getYahooPrice(symbol, date);
    }
}

export async function getPriceByContractAddress(ca: string): Promise<any | null> {
    try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, { cache: 'no-store' });
        const data = await response.json();

        if (data.pairs && data.pairs.length > 0) {
            // Sort by liquidity? or just take the first one (usually simplified)
            const pair = data.pairs[0];
            return {
                price: parseFloat(pair.priceUsd),
                symbol: pair.baseToken.symbol,
                name: pair.baseToken.name,
                liquidity: pair.liquidity?.usd,
                marketCap: pair.fdv,
                priceChange: pair.priceChange, // { h1: ..., h6: ..., h24: ... }
                pairCreatedAt: pair.pairCreatedAt,
            };
        }
    } catch (e) {
        console.error('DexScreener API Error:', e);
    }
    return null;
}

/**
 * Calculates percentage change
 */
export function calculatePerformance(callPrice: number, currentPrice: number, sentiment: 'BULLISH' | 'BEARISH'): number {
    const rawChange = ((currentPrice - callPrice) / callPrice) * 100;

    // If Bearish, a drop in price (negative rawChange) is a WIN (positive performance)
    // e.g. Call Price 100, Current 80. Raw = -20%. Performance = +20%.
    if (sentiment === 'BEARISH') {
        return -rawChange;
    }

    return rawChange;
}

/**
 * Fetches price from Yahoo Finance Chart API
 * Supports precise Hourly resolution for recent tweets.
 */
async function getYahooPrice(symbol: string, date?: Date): Promise<number | null> {
    try {
        // noStore(); // Opt out of static caching for this function scope if needed

        let period1 = 0;
        let period2 = 9999999999;

        if (date) {
            // Check if date is recent (within 730 days) to use Hourly data for better precision
            const now = new Date();
            const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
            const isRecent = diffDays < 700; // Safe buffer for Yahoo's 730 day limit

            if (isRecent) {
                // Use Hourly Data for higher precision
                // Fetch window around the target time (-12h to +12h) to find closest candle
                period1 = Math.floor(date.getTime() / 1000) - (12 * 3600);
                period2 = Math.floor(date.getTime() / 1000) + (12 * 3600);

                // Construct URL with 1h interval
                const url = `${YAHOO_BASE}/${symbol}?period1=${period1}&period2=${period2}&interval=1h&events=history`;

                // Use no-store to prevent Next.js caching staled/failed requests
                const res = await fetch(url, { cache: 'no-store' });

                if (!res.ok) {
                    console.warn(`[MarketData] Yahoo Hourly Fetch failed: ${res.status}`);
                    // Fall back to daily if hourly fails (e.g. rate limit specifically on hourly?)
                } else {
                    const json = await res.json();
                    const result = json?.chart?.result?.[0];
                    const quotes = result?.indicators?.quote?.[0];
                    const timestamps = result?.timestamp;

                    if (timestamps && quotes && quotes.close && quotes.close.length > 0) {
                        // Find the candle closest to target time
                        let closestPrice = null;
                        let minDiff = Infinity;

                        const targetTime = date.getTime() / 1000;

                        for (let i = 0; i < timestamps.length; i++) {
                            const t = timestamps[i];
                            const diff = Math.abs(t - targetTime);

                            if (diff < minDiff && quotes.close[i] !== null) {
                                minDiff = diff;
                                closestPrice = quotes.close[i];
                            }
                        }

                        if (closestPrice !== null) {
                            return closestPrice;
                        }
                    }
                }
            }

            // Fallback to Daily Logic (Original)
            // Historical Window: Date -> Date + 4 days (to catch weekends/holidays)
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

        const res = await fetch(url, { cache: 'no-store' });
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
