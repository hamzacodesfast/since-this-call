/**
 * @file price-refresher.ts
 * @description Batch price refresh engine for live call tracking
 */
import { Redis } from '@upstash/redis';
import { StoredAnalysis, recalculateUserProfile } from './analysis-store';
import { calculatePerformance, getPrice } from './market-data';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// CoinGecko ID mapping (kept for batching efficiency)
const COINGECKO_IDS: Record<string, string> = {
    'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'DOGE': 'dogecoin', 'XRP': 'ripple',
    'BNB': 'binancecoin', 'LTC': 'litecoin', 'ADA': 'cardano', 'AVAX': 'avalanche-2',
    'DOT': 'polkadot', 'LINK': 'chainlink', 'TON': 'the-open-network', 'UNI': 'uniswap',
    'NEAR': 'near', 'SUI': 'sui', 'PEPE': 'pepe', 'SHIB': 'shiba-inu', 'HYPE': 'hyperliquid',
    'AI16Z': 'ai16z', 'VIRTUAL': 'virtual-protocol', 'RENDER': 'render-token', 'FET': 'fetch-ai',
    'MOLT': 'moltbook',
};

interface RefreshResult {
    updated: number;
    errors: number;
    skipped: number;
}

async function batchFetchCoinGeckoPrices(symbols: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    const ids = symbols.map(s => COINGECKO_IDS[s.toUpperCase()]).filter(Boolean);
    if (ids.length === 0) return prices;

    const apiKey = process.env.COINGECKO_API_KEY;
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (apiKey) headers['x-cg-demo-api-key'] = apiKey;

    try {
        const url = `${COINGECKO_BASE}/simple/price?ids=${ids.join(',')}&vs_currencies=usd`;
        const res = await fetch(url, { headers, cache: 'no-store' });
        if (!res.ok) return prices;
        const data = await res.json();
        for (const symbol of symbols) {
            const cgId = COINGECKO_IDS[symbol.toUpperCase()];
            if (cgId && data[cgId]?.usd) prices.set(symbol.toUpperCase(), data[cgId].usd);
        }
    } catch (e) {
        console.error('[PriceRefresher] CoinGecko error:', e);
    }
    return prices;
}

async function batchFetchYahooPrices(symbols: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    if (symbols.length === 0) return prices;

    const promises = symbols.map(async (symbol) => {
        try {
            const price = await getPrice(symbol, 'STOCK');
            if (price) prices.set(symbol.toUpperCase(), price);
        } catch (e) { }
    });
    await Promise.all(promises);
    return prices;
}

export async function refreshByTicker(): Promise<RefreshResult> {
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
        token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
    });

    const result: RefreshResult = { updated: 0, errors: 0, skipped: 0 };

    try {
        const trackedTickers = await redis.smembers('tracked_tickers') as string[];
        if (trackedTickers.length === 0) return result;

        const cgSymbols: string[] = [];
        const yahooSymbols: string[] = [];
        const cas: string[] = [];

        for (const ticker of trackedTickers) {
            if (ticker.startsWith('CA:')) cas.push(ticker); // Handled via individual lookup for now
            else if (ticker.startsWith('STOCK:')) yahooSymbols.push(ticker.slice(6));
            else if (ticker.startsWith('CRYPTO:')) {
                const s = ticker.slice(7);
                if (COINGECKO_IDS[s]) cgSymbols.push(s);
                else yahooSymbols.push(s); // Try Yahoo fallback
            }
        }

        const [cgPrices, yahooPrices] = await Promise.all([
            batchFetchCoinGeckoPrices(cgSymbols),
            batchFetchYahooPrices([...yahooSymbols]),
        ]);

        const priceMap = new Map<string, number>();
        for (const [s, p] of cgPrices) priceMap.set(`CRYPTO:${s}`, p);
        for (const [s, p] of yahooPrices) {
            priceMap.set(`STOCK:${s}`, p);
            priceMap.set(`CRYPTO:${s}`, p); // Fallback mapping
        }

        const affectedUsers = new Set<string>();
        const updatedIds = new Set<string>();

        for (const ticker of trackedTickers) {
            let newPrice = priceMap.get(ticker);

            // Individual fallback for things not in batch (like MOLT via CA)
            if (!newPrice && ticker.startsWith('CA:')) {
                // We keep CA keys in Redis only for known identities.
                // Since this ticker has no price, it might be a remnant.
            }

            if (!newPrice) {
                result.skipped++;
                continue;
            }

            const analysisRefs = await redis.zrange(`ticker_index:${ticker}`, 0, -1) as string[];
            for (const ref of analysisRefs) {
                const [username, tweetId] = ref.split(':');
                const historyKey = `user:history:${username}`;
                const historyData = await redis.lrange(historyKey, 0, -1);
                const history: StoredAnalysis[] = historyData.map((item: any) =>
                    typeof item === 'string' ? JSON.parse(item) : item
                );

                let updated = false;
                for (const a of history) {
                    if (a.id === tweetId && a.entryPrice && a.currentPrice !== newPrice) {
                        a.currentPrice = newPrice;
                        a.performance = calculatePerformance(a.entryPrice, newPrice, a.sentiment);
                        a.isWin = a.performance > 0;
                        updated = true;
                        result.updated++;
                        affectedUsers.add(username);
                        updatedIds.add(a.id);
                    }
                }

                if (updated) {
                    await redis.del(historyKey);
                    for (let i = history.length - 1; i >= 0; i--) {
                        await redis.lpush(historyKey, JSON.stringify(history[i]));
                    }
                }
            }
        }

        for (const username of affectedUsers) await recalculateUserProfile(username);

        const recentData = await redis.lrange('recent_analyses', 0, -1);
        const recent: StoredAnalysis[] = recentData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );
        let recentUpdated = false;
        for (const r of recent) {
            const ticker = `${r.type || 'CRYPTO'}:${r.symbol.toUpperCase()}`;
            const np = priceMap.get(ticker);
            if (np && r.entryPrice && r.currentPrice !== np) {
                r.currentPrice = np;
                r.performance = calculatePerformance(r.entryPrice, np, r.sentiment);
                r.isWin = r.performance > 0;
                recentUpdated = true;
            }
        }
        if (recentUpdated) {
            await redis.del('recent_analyses');
            for (let i = recent.length - 1; i >= 0; i--) {
                await redis.lpush('recent_analyses', JSON.stringify(recent[i]));
            }
        }
    } catch (e) {
        console.error('[PriceRefresher] Fatal error:', e);
        result.errors++;
    }
    return result;
}
