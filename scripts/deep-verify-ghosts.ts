
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

/**
 * deep-verify-ghosts.ts
 * 
 * Scans all ticker indices to see if we can find the 2,687 "missing" calls.
 */

dotenv.config({ path: path.resolve(process.cwd(), '.env.production.local'), override: true });

const SOURCE_URL = process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL || '';
const SOURCE_TOKEN = process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN || '';

if (!SOURCE_URL || !SOURCE_TOKEN) {
    console.error('❌ Upstash credentials missing');
    process.exit(1);
}

async function deepScan() {
    const redis = new Redis({ url: SOURCE_URL, token: SOURCE_TOKEN });

    console.log('📦 FETCHING TICKER LIST...');
    const tickers = await redis.smembers('tracked_tickers') as string[];
    console.log(`   Found ${tickers.length} tickers.`);

    console.log('🧐 COLLECTING ALL TICKER INDEX MEMBERS...');
    const allTickerMembers = new Set<string>();
    
    // Chunked ticker scanning
    const CHUNK_SIZE = 50;
    for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
        const chunk = tickers.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (ticker) => {
            const members = await redis.zrange(`ticker_index:${ticker}`, 0, -1);
            members.forEach(m => allTickerMembers.add(m as string));
        }));
        console.log(`   Scanned ${i + chunk.length}/${tickers.length} tickers...`);
    }

    console.log(`\n📊 TICKER INDEX RESULTS:`);
    console.log(`   Total unique analysis references in ticker indices: ${allTickerMembers.size}`);

    console.log('📊 GLOBAL INDEX RESULTS:');
    const globalRefs = await redis.zrange('global:analyses:timestamp', 0, -1) as string[];
    console.log(`   Total items in global index: ${globalRefs.length}`);

    // Check overlap
    const inGlobalNotTicker = globalRefs.filter(ref => !allTickerMembers.has(ref));
    const inTickerNotGlobal = Array.from(allTickerMembers).filter(ref => !globalRefs.includes(ref));

    console.log(`\n⚠️  In Global Index but MISSING from ANY Ticker Index: ${inGlobalNotTicker.length}`);
    console.log(`⚠️  In Ticker Index but MISSING from Global Index: ${inTickerNotGlobal.length}`);

    console.log('\n✅ Deep scan complete.');
}

deepScan();
