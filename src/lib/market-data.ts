
import { unstable_noStore as noStore } from 'next/cache';

const YAHOO_BASE = 'https://query2.finance.yahoo.com/v8/finance/chart';

// Optional: Custom CA mappings if search isn't enough
const CUSTOM_CA_MAPPING: Record<string, string> = {
    // 'HYPE': '...', // Mapped via Yahoo Ticker below
};

export async function getPrice(symbol: string, type: 'CRYPTO' | 'STOCK', date?: Date): Promise<number | null> {
    // 1. Check Custom CA Mapping
    if (CUSTOM_CA_MAPPING[symbol]) {
        return getDexPriceWithHistory(CUSTOM_CA_MAPPING[symbol], date);
    }

    // 2. Try Yahoo Finance
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
            'HYPE': 'HYPE32196-USD', // Hyperliquid (Yahoo Ticker)
        };
        const yahooSymbol = mapping[symbol] || `${symbol}-USD`;
        const yahooPrice = await getYahooPrice(yahooSymbol, date);

        if (yahooPrice !== null) return yahooPrice;

        // 3. Fallback: DexScreener Search (Generic)
        // If Yahoo failed, try searching DexScreener for the symbol
        console.log(`[MarketData] Yahoo failed for ${symbol}, trying DexScreener Search...`);
        const ca = await searchDexScreenerCA(symbol);
        if (ca) {
            console.log(`[MarketData] Found CA for ${symbol}: ${ca}`);
            return getDexPriceWithHistory(ca, date);
        }
    } else {
        return getYahooPrice(symbol, date);
    }

    return null;
}

// Helper to get price (current or estimated historical) from DexScreener
async function getDexPriceWithHistory(ca: string, date?: Date): Promise<number | null> {
    try {
        const data = await getPriceByContractAddress(ca);
        if (data) {
            // If we need historical price (date provided)
            if (date) {
                const now = new Date();
                const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

                // Allow estimation for tweets up to 24h old (using h24 change)
                if (diffHours <= 24 && data.priceChange && data.priceChange.h24 !== undefined) {
                    let change = 0;
                    if (diffHours <= 1) change = data.priceChange.h1;
                    else if (diffHours <= 6) change = data.priceChange.h6;
                    else change = data.priceChange.h24;

                    return data.price / (1 + change / 100);
                } else if (diffHours > 24) {
                    // Start of day fallback? No, DexScreener doesn't give candles.
                    // Just return current price? Or null?
                    // Returning current gives 0% gain/loss. Better than error?
                    // Returning null prevents analysis.
                    // Let's return current ONLY if it's "close enough"? 
                    // No, for "Market Data Not Found", getting current price is confusing for old tweets.
                    // But for "bag of 67" tweet, if it's new, it works.
                }
            }
            return data.price;
        }
    } catch (e) {
        console.warn('[MarketData] Dex Price fetch failed:', e);
    }
    return null;
}

async function searchDexScreenerCA(symbol: string): Promise<string | null> {
    try {
        const url = `https://api.dexscreener.com/latest/dex/search/?q=${symbol}`;
        const res = await fetch(url, { cache: 'no-store' } as any);
        const json = await res.json();

        if (json.pairs && json.pairs.length > 0) {
            // Filter for exact symbol match (case-insensitive) to avoid noise
            // e.g. searching "AI" -> "AIX", "AIM". We want "AI".
            const matches = json.pairs.filter((p: any) => p.baseToken.symbol.toUpperCase() === symbol.toUpperCase());

            if (matches.length > 0) {
                // Sort by liquidity
                matches.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
                return matches[0].baseToken.address;
            }

            // If no exact match, maybe take top result if query was specific? 
            // "67" query -> "67" symbol.
            // If query "Trump" -> symbol "TRUMP". 
            // Let's be strict on Symbol match to avoid returning random tokens for common words.
        }
    } catch (e) {
        console.error('[MarketData] Search failed:', e);
    }
    return null;
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
