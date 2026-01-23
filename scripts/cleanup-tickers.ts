
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function main() {
    console.log('Running ticker cleanup...');

    // 1. Rename $HYPE -> HYPE
    const badHype = 'CRYPTO:$HYPE';
    const goodHype = 'CRYPTO:HYPE';

    const badExists = await redis.sismember('tracked_tickers', badHype);
    if (badExists) {
        console.log(`Found ${badHype}, merging into ${goodHype}...`);

        const badIndex = `ticker_index:${badHype}`;
        const goodIndex = `ticker_index:${goodHype}`;

        // Move all analysis refs from bad to good index
        const refs = await redis.smembers(badIndex);
        if (refs.length > 0) {
            await redis.sadd(goodIndex, ...refs);
            console.log(`Moved ${refs.length} refs from $HYPE to HYPE`);
        }

        // Clean up bad keys
        await redis.del(badIndex);
        await redis.srem('tracked_tickers', badHype);
        console.log(`Deleted ${badHype} keys`);

        // Ensure good key is tracked
        await redis.sadd('tracked_tickers', goodHype);
    } else {
        console.log(`${badHype} not found (might already be clean).`);
    }

    // 2. Remove any other $ prefixed tickers if found (generic cleanup)
    const tickers = await redis.smembers('tracked_tickers');
    for (const t of tickers) {
        if (t.startsWith('CRYPTO:$')) {
            const clean = t.replace('CRYPTO:$', 'CRYPTO:');
            console.log(`Found generic bad ticker: ${t} -> ${clean}`);

            const badIndex = `ticker_index:${t}`;
            const goodIndex = `ticker_index:${clean}`;

            const refs = await redis.smembers(badIndex);
            if (refs.length > 0) {
                await redis.sadd(goodIndex, ...refs);
                console.log(`Moved ${refs.length} refs`);
            }

            await redis.del(badIndex);
            await redis.srem('tracked_tickers', t);
            await redis.sadd('tracked_tickers', clean);
            console.log(`Cleaned up ${t}`);
        }
    }

    // 3. Force re-add BULLISH and LIT just to be sure they are tracked if referenced
    // (Actually tracked_tickers is auto-maintained, but if we updated mappings we might want to manually check indexes?
    //  No, indexes are based on what's in the analyses. If analyses say LIT, it uses LIT key.)

    console.log('Cleanup complete.');
}

main().catch(console.error);
