import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

// CoinGecko IDs from price-refresher.ts
const COINGECKO_IDS: Record<string, string> = {
    'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'DOGE': 'dogecoin',
    'XRP': 'ripple', 'BNB': 'binancecoin', 'LTC': 'litecoin', 'ADA': 'cardano',
    'AVAX': 'avalanche-2', 'DOT': 'polkadot', 'MATIC': 'matic-network',
    'LINK': 'chainlink', 'TON': 'the-open-network', 'TRX': 'tron', 'UNI': 'uniswap',
    'ATOM': 'cosmos', 'APT': 'aptos', 'ARB': 'arbitrum', 'OP': 'optimism',
    'SUI': 'sui', 'NEAR': 'near', 'SEI': 'sei-network', 'INJ': 'injective-protocol',
    'FTM': 'fantom', 'ALGO': 'algorand', 'ICP': 'internet-computer', 'FIL': 'filecoin',
    'HBAR': 'hedera-hashgraph', 'VET': 'vechain', 'GAS': 'gas', 'PEPE': 'pepe',
    'SHIB': 'shiba-inu', 'HYPE': 'hyperliquid', 'WIF': 'dogwifcoin', 'BONK': 'bonk',
    'FLOKI': 'floki', 'TRUMP': 'official-trump', 'PENGU': 'pudgy-penguins',
    'FARTCOIN': 'fartcoin', 'SPX6900': 'spx6900', 'AI16Z': 'ai16z', 'MELANIA': 'melania-meme',
    'ONDO': 'ondo-finance', 'AAVE': 'aave', 'LDO': 'lido-dao', 'RUNE': 'thorchain',
    'AXS': 'axie-infinity', 'aura': 'aura-finance', 'ASTER': 'aster-2'
};

async function checkSkipped() {
    const tickers = await redis.smembers('tracked_tickers') as string[];
    const skipped: string[] = [];

    for (const ticker of tickers) {
        if (ticker.startsWith('CA:')) continue;
        if (ticker.startsWith('STOCK:')) continue;
        if (ticker.startsWith('CRYPTO:')) {
            const symbol = ticker.slice(7);
            if (!COINGECKO_IDS[symbol]) {
                skipped.push(symbol);
            }
        }
    }

    console.log('\n📊 SKIPPED CRYPTO TICKERS (no CoinGecko ID):');
    console.log('Total: ' + skipped.length);
    skipped.sort().forEach(s => console.log('  - ' + s));

    process.exit(0);
}

checkSkipped();
