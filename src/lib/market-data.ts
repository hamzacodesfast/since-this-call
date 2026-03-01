/**
 * @file market-data.ts
 * @description Price fetching engine with major provider waterfall: Yahoo Finance, CoinMarketCap, CoinGecko.
 * 
 * The system no longer supports DEX-only or pump.fun tokens. 
 * Any asset not found on the major providers listed above is rejected.
 */

import { unstable_noStore as noStore } from 'next/cache';

const YAHOO_BASE = 'https://query2.finance.yahoo.com/v8/finance/chart';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CMC_BASE = 'https://pro-api.coinmarketcap.com/v1';

// Known Stock Tickers to enforce Type: STOCK
const KNOWN_STOCKS: Set<string> = new Set([
    'MSTR', 'COIN', 'HOOD', 'TSLA', 'NVDA', 'AMD', 'INTC', 'AAPL', 'MSFT', 'GOOG', 'AMZN', 'NFLX', 'META', 'SPY', 'QQQ', 'IWM', 'DIA', 'GLD', 'SLV', 'TLT',
    'OKLO', 'SMR', 'ONDS', 'ASST', 'PLTR', 'MCD', 'BIZIM', 'DXY', 'XAU', 'XAG', 'XAUUSD', 'XAGUSD', 'OPEN',
    'GME', 'BABA', 'LAC', 'HIMS', 'SOFI', 'MARA', 'RIOT', 'CLSK', 'BITF', 'IREN', 'AMR', 'HCC', 'ARCH', 'BTU', 'CEIX', 'STLA', 'STX', 'CRCL', 'BMNR',
    'GC1:COM'
]);

/**
 * Infers the asset type based on the symbol.
 */
export function inferAssetType(symbol: string): 'CRYPTO' | 'STOCK' {
    const clean = symbol.replace(/^\$/, '').toUpperCase();
    if (KNOWN_STOCKS.has(clean)) {
        return 'STOCK';
    }

    // Default to STOCK for 1-4 character symbols unless it's a known crypto major
    // This prevents common stock tickers from being treated as crypto (e.g. LAC, GME)
    const CRYPTO_MAJORS = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'DOT', 'LINK', 'PEPE', 'WIF', 'BONK', 'HYPE', 'CHZ', 'ZEN', 'ZEC', 'TAO', 'WLFI', 'SUI', 'APT', 'NEAR', 'AVAX', 'MATIC', 'ARB', 'OP', 'TON']);
    if (CRYPTO_MAJORS.has(clean)) {
        return 'CRYPTO';
    }

    if (clean.length > 5) return 'CRYPTO'; // Long symbols usually tokens

    return 'STOCK'; // Default to stock for short unknown symbols
}

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
    'TON': 'the-open-network',
    'AI16Z': 'ai16z',
    'VIRTUAL': 'virtual-protocol',
    'AI': 'artificial-intelligence',
    'GOAT': 'goatseus-maximus',
    'SPX6900': 'spx6900',
    'ZEREBRO': 'zerebro',
    'AIXBT': 'aixbt',
    'GRIFFAIN': 'griffain',
    'MOLT': 'moltbook',
    'CHZ': 'chiliz',
    'ZEN': 'horizen',
    'ZEC': 'zcash',
    'TAO': 'bittensor',
    'ASTER': 'aster-2',
    'ASTR': 'astar',
    'WLFI': 'world-liberty-financial',
    'ROSE': 'oasis-network',
    'RIVER': 'river',
};

// Launch dates and initial prices for major assets
const LAUNCH_DATES: Record<string, { date: Date, price: number }> = {
    'BTC': { date: new Date('2010-07-17'), price: 0.0008 },
    'ETH': { date: new Date('2015-08-07'), price: 2.77 },
    'SOL': { date: new Date('2020-03-16'), price: 0.22 },
};

let cachedIndices: Record<string, number> | null = null;
let lastIndicesFetch = 0;
const INDICES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get current prices for major indices/cryptos to provide context to the AI.
 */
export async function getMajorIndicesPrices(): Promise<Record<string, number>> {
    const now = Date.now();
    if (cachedIndices && (now - lastIndicesFetch < INDICES_CACHE_TTL)) {
        return cachedIndices;
    }

    try {
        const [btc, eth, sol] = await Promise.all([
            getPrice('BTC', 'CRYPTO'),
            getPrice('ETH', 'CRYPTO'),
            getPrice('SOL', 'CRYPTO'),
        ]);

        cachedIndices = {
            'BTC': btc || 0,
            'ETH': eth || 0,
            'SOL': sol || 0,
        };
        lastIndicesFetch = now;
        return cachedIndices;
    } catch (e) {
        console.error('[MarketData] Failed to fetch major indices:', e);
        return cachedIndices || {};
    }
}

const currentPriceCache: Record<string, { price: number | null, timestamp: number }> = {};
const PRICE_CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * Main price fetching engine. Waterfall through Yahoo -> CMC -> CoinGecko.
 */
export async function getPrice(symbol: string, type?: 'CRYPTO' | 'STOCK', date?: Date): Promise<number | null> {
    symbol = symbol.replace(/^\$/, '').toUpperCase();

    // Check cache for current price
    if (!date) {
        const cached = currentPriceCache[symbol];
        if (cached && (Date.now() - cached.timestamp < PRICE_CACHE_TTL)) {
            // console.log(`[Price] Cache hit for ${symbol}: ${cached.price}`);
            return cached.price;
        }
    }

    // FORCE CRYPTO MAJORS: Prevent collisions with stock/ETF tickers (e.g. BTC Mini Trust ETF at $30)
    const CRYPTO_MAJORS_FORCE = ['BTC', 'ETH', 'SOL', 'USDT'];
    if (CRYPTO_MAJORS_FORCE.includes(symbol)) {
        type = 'CRYPTO';
    }

    if (KNOWN_STOCKS.has(symbol) && type !== 'CRYPTO') {
        type = 'STOCK';
    }
    if (!type) {
        type = inferAssetType(symbol);
    }

    // Normalization logic for stocks...
    const STOCK_OVERRIDES: Record<string, string> = {
        'GOLD': 'GLD',
        'SILVER': 'SI=F',
        'BIZIM': 'BIZIM.IS',
        'GC1:COM': 'GC=F',
    };
    if (STOCK_OVERRIDES[symbol]) {
        symbol = STOCK_OVERRIDES[symbol];
    } else if (symbol.endsWith('_F')) {
        symbol = symbol.replace('_F', '=F');
    }

    if (date) {
        const launchData = LAUNCH_DATES[symbol];
        if (launchData && date < launchData.date) {
            return launchData.price;
        }
    }

    const YAHOO_SKIP_CRYPTO = new Set(['TAO', 'ASTER', 'SUI', 'APT', 'PEPE']);
    let price: number | null = null;

    if (type === 'CRYPTO') {
        const mapping: Record<string, string> = {
            'BTC': 'BTC-USD',
            'ETH': 'ETH-USD',
            'SOL': 'SOL-USD',
            'DOGE': 'DOGE-USD',
            'XRP': 'XRP-USD',
            'HYPE': 'HYPE32196-USD',
            'CHZ': 'CHZ-USD',
            'ZEN': 'ZEN-USD',
            'ASTR': 'ASTR-USD',
        };

        const yahooSymbol = mapping[symbol] || `${symbol}-USD`;
        if (!YAHOO_SKIP_CRYPTO.has(symbol)) {
            console.log(`[Price] Trying Yahoo: ${yahooSymbol}`);
            const yahooPrice = await getYahooPrice(yahooSymbol, date);
            if (yahooPrice !== null && yahooPrice > 0.000001) {
                console.log(`[Price] Yahoo success for ${yahooSymbol}: ${yahooPrice}`);
                price = yahooPrice;
            }
        }

        if (price === null) {
            const cmcPrice = await getCoinMarketCapPrice(symbol, date);
            if (cmcPrice !== null) {
                console.log(`[Price] CMC success for ${symbol}: ${cmcPrice}`);
                price = cmcPrice;
            }
        }

        if (price === null) {
            const coinGeckoId = COINGECKO_IDS[symbol.toUpperCase()];
            if (coinGeckoId) {
                const cgPrice = await getCoinGeckoPrice(coinGeckoId, date);
                if (cgPrice !== null) {
                    console.log(`[Price] CG success for ${coinGeckoId}: ${cgPrice}`);
                    price = cgPrice;
                }
            }
        }

        if (price === null) {
            console.log(`[Price] All providers failed for ${symbol}`);
        }
    } else {
        price = await getYahooPrice(symbol, date);
    }

    // Update cache for current prices
    if (!date) {
        currentPriceCache[symbol] = { price, timestamp: Date.now() };
    }

    return price;
}

async function getCoinMarketCapPrice(symbol: string, date?: Date): Promise<number | null> {
    const apiKey = process.env.COINMARKETCAP_API_KEY;
    if (!apiKey || date) return null; // Historical CMC often paid

    try {
        const url = `${CMC_BASE}/cryptocurrency/quotes/latest?symbol=${symbol}&convert=USD`;
        const res = await fetch(url, {
            headers: { 'X-CMC_PRO_API_KEY': apiKey, 'Accept': 'application/json' },
            cache: 'no-store'
        } as any);
        if (!res.ok) return null;
        const json = await res.json();
        const data = json.data[symbol.toUpperCase()];
        if (Array.isArray(data) && data.length > 0) return data[0].quote.USD.price;
        if (data && data.quote) return data.quote.USD.price;
    } catch (e) {
        console.error('[CMC] Error:', e);
    }
    return null;
}

async function getCoinGeckoPrice(coinId: string, date?: Date): Promise<number | null> {
    const apiKey = process.env.COINGECKO_API_KEY;
    if (!apiKey) return null;

    try {
        const headers = { 'x-cg-demo-api-key': apiKey, 'Accept': 'application/json' };
        if (date) {
            const now = new Date();
            const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays > 365) return null;

            let days = Math.ceil(diffDays) + 1;
            days = Math.min(Math.max(days, 2), 90);

            const url = `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
            const res = await fetch(url, { headers, cache: 'no-store' } as any);
            if (!res.ok) return null;

            const data = await res.json();
            if (!data.prices || data.prices.length === 0) return null;

            const targetTime = date.getTime();
            let closestPrice = data.prices[0][1];
            let minDiff = Math.abs(data.prices[0][0] - targetTime);

            for (const [timestamp, price] of data.prices) {
                const diff = Math.abs(timestamp - targetTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestPrice = price;
                }
            }
            return closestPrice;
        } else {
            const url = `${COINGECKO_BASE}/simple/price?ids=${coinId}&vs_currencies=usd`;
            const res = await fetch(url, { headers, cache: 'no-store' } as any);
            if (!res.ok) return null;
            const data = await res.json();
            return data[coinId]?.usd || null;
        }
    } catch (e) {
        console.error('[CoinGecko] Error:', e);
    }
    return null;
}

export function calculatePerformance(callPrice: number, currentPrice: number, sentiment: 'BULLISH' | 'BEARISH'): number {
    const rawChange = ((currentPrice - callPrice) / callPrice) * 100;
    return sentiment === 'BEARISH' ? -rawChange : rawChange;
}

const INDEX_FALLBACKS: Record<string, string> = {
    'SPX': 'SPY', '^GSPC': 'SPY', '^SPX': 'SPY', 'ES': 'SPY', 'ES=F': 'SPY',
    'NDX': 'QQQ', '^NDX': 'QQQ', '^IXIC': 'QQQ', 'NQ': 'QQQ', 'NQ=F': 'QQQ',
    'GOLD': 'GC=F', 'XAU': 'GC=F', 'GC1:COM': 'GC=F', 'SILVER': 'SI=F', 'XAG': 'SI=F',
    'DXY': 'DX-Y.NYB',
};

async function getYahooPrice(symbol: string, date?: Date): Promise<number | null> {
    let price = await getYahooPriceInternal(symbol, date);
    if (price !== null) return price;

    const fallback = INDEX_FALLBACKS[symbol.toUpperCase()];
    if (fallback) return getYahooPriceInternal(fallback, date);
    return null;
}

async function getYahooPriceInternal(symbol: string, date?: Date): Promise<number | null> {
    try {
        let period1, period2;
        if (date) {
            const targetTime = Math.floor(date.getTime() / 1000);
            const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);

            // USE MINUTE DATA (1m) FOR 30 DAYS, 5m FOR 60 DAYS
            // Increased range to 43200s (12h) to catch overnight "dead zones" (8 PM - 4 AM)
            let strategy = diffDays < 30 ? { interval: '1m', range: 43200 } : diffDays < 60 ? { interval: '5m', range: 86400 } : { interval: '1h', range: 172800 };

            const url = `${YAHOO_BASE}/${symbol}?period1=${targetTime - strategy.range}&period2=${targetTime + strategy.range}&interval=${strategy.interval}&events=history&includePrePost=true`;
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' } as any);
            if (res.ok) {
                const json = await res.json();
                const result = json.chart.result[0];
                const quotes = result.indicators.quote[0];
                const adjclose = result.indicators.adjclose?.[0]?.adjclose || quotes.close; // Fallback to close if adjclose missing
                const times = result.timestamp;
                if (times && adjclose.length) {
                    let best = null, mindiff = Infinity;
                    for (let i = 0; i < times.length; i++) {
                        const d = Math.abs(times[i] - targetTime);
                        if (d < mindiff && adjclose[i] !== null) { mindiff = d; best = adjclose[i]; }
                    }
                    if (best !== null) return best;
                }
            }
            // Daily fallback
            const from = new Date(date); from.setDate(from.getDate() - 1);
            period1 = Math.floor(from.getTime() / 1000);
            const to = new Date(date); to.setDate(to.getDate() + 4);
            period2 = Math.floor(to.getTime() / 1000);
        } else {
            const now = new Date();
            period2 = Math.floor(now.getTime() / 1000);
            const from = new Date(now); from.setDate(from.getDate() - 5);
            period1 = Math.floor(from.getTime() / 1000);
        }

        const url = `${YAHOO_BASE}/${symbol}?period1=${period1}&period2=${period2}&interval=1d&events=history`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' } as any);
        if (!res.ok) return null;
        const json = await res.json();
        const result = json.chart.result[0];
        if (!result) return null;
        const quotes = result.indicators.quote[0];
        const adjclose = result.indicators.adjclose?.[0]?.adjclose || quotes.close;
        if (!date && result.meta?.regularMarketPrice) return result.meta.regularMarketPrice;
        if (adjclose && adjclose.length) {
            const valid = adjclose.filter((p: any) => p !== null);
            let p = valid.length > 0 ? valid[0] : null;

            // SPECIAL CASE: Yahoo SI=F and GC=F sometimes include a multiplier in metadata
            // If SI=F is above 50, it's likely quoted in a way that needs scaling down (e.g. 82 -> 31)
            // But actually 31 is the correct price. 
            // If the price comes back as 82, it's garbage from a weird provider.
            // We return null to fallback to next provider if available or just return the flawed value.
            return p;
        }
    } catch (e) {
        console.error('[Yahoo] Error:', e);
    }
    return null;
}
