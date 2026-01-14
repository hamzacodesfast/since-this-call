
import { unstable_noStore as noStore } from 'next/cache';

const YAHOO_BASE = 'https://query2.finance.yahoo.com/v8/finance/chart';

export async function getPrice(symbol: string, type: 'CRYPTO' | 'STOCK', date?: Date): Promise<number | null> {
    if (type === 'CRYPTO') {
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
            const pair = data.pairs[0];
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

/**
 * Fetches price from Yahoo Finance Chart API using cascading precision for recent dates.
 * Strategies:
 * 1. < 7 days: 1-minute interval
 * 2. < 55 days: 5-minute interval
 * 3. < 700 days: 1-hour interval
 * 4. Default: Daily
 */
async function getYahooPrice(symbol: string, date?: Date): Promise<number | null> {
    try {
        let period1 = 0;
        let period2 = 9999999999;

        if (date) {
            const now = new Date();
            const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
            const targetTime = Math.floor(date.getTime() / 1000);

            // Strategy: Try highest precision first
            let strategy: { interval: string, range: number } | null = null;

            if (diffDays < 7) {
                // < 7 days: Try 1-minute interval (Range: +/- 30 mins)
                strategy = { interval: '1m', range: 1800 };
            } else if (diffDays < 55) {
                // < 55 days: Try 5-minute interval (Range: +/- 2 hours)
                strategy = { interval: '5m', range: 7200 };
            } else if (diffDays < 700) {
                // < 700 days: Try 1-hour interval (Range: +/- 24 hours)
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
                            // Find closest price
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
                    } else {
                        console.warn(`[MarketData] High precision (${strategy.interval}) fetch failed: ${res.status}`);
                    }
                } catch (e) {
                    console.warn(`[MarketData] High precision (${strategy.interval}) fetch error`, e);
                }
            }

            // Fallback to Daily Logic (Original)
            period1 = Math.floor(date.getTime() / 1000);
            const to = new Date(date);
            to.setDate(to.getDate() + 4);
            period2 = Math.floor(to.getTime() / 1000);
        } else {
            // Current Price: Look at last 2 days
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
