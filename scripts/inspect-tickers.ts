
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function main() {
    console.log('Fetching tracked tickers...');
    const tickers = await redis.smembers('tracked_tickers');

    console.log(`Total keys: ${tickers.length}`);

    // Group by prefix
    const crypto = [];
    const stock = [];
    const ca = [];

    for (const t of tickers) {
        if (t.startsWith('CRYPTO:')) crypto.push(t.substring(7));
        else if (t.startsWith('STOCK:')) stock.push(t.substring(6));
        else if (t.startsWith('CA:')) ca.push(t.substring(3));
        else console.warn('Unknown format:', t);
    }

    console.log(`\nCRYPTO (${crypto.length}):`, crypto.sort().join(', '));
    console.log(`\nSTOCK (${stock.length}):`, stock.sort().join(', '));
    console.log(`\nCA (${ca.length}):`, ca.length); // CAs are long, just count or list first few

    // Check for potential overlaps
    // e.g. if we have CRYPTO:PEPE and also a CA for PEPE

    // We can't know for sure without checking what the CA resolves to, 
    // but we can list CAs and see if we can identify them.

    // Check for case duplicates in CRYPTO/STOCK (though code forces uppercase)
    const findCaseDupes = (arr: string[], type: string) => {
        const lowerMap = new Map();
        for (const item of arr) {
            const lower = item.toLowerCase();
            if (lowerMap.has(lower)) {
                console.error(`🚨 Possible duplicate in ${type}: ${item} vs ${lowerMap.get(lower)}`);
            }
            lowerMap.set(lower, item);
        }
    };

    findCaseDupes(crypto, 'CRYPTO');
    findCaseDupes(stock, 'STOCK');
}

main().catch(console.error);
