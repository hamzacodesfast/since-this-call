/**
 * Backfill script to populate the ticker index for all existing analyses.
 * Run once to build the index, then new analyses will be tracked automatically.
 */

import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const TRACKED_TICKERS_KEY = 'tracked_tickers';
const TICKER_INDEX_PREFIX = 'ticker_index:';

interface StoredAnalysis {
    id: string;
    username: string;
    symbol: string;
    type?: 'CRYPTO' | 'STOCK';
    contractAddress?: string;
}

function getTickerKey(analysis: StoredAnalysis): string {
    if (analysis.contractAddress && analysis.contractAddress.length > 10) {
        return `CA:${analysis.contractAddress}`;
    }
    const type = analysis.type || 'CRYPTO';
    return `${type}:${analysis.symbol.toUpperCase()}`;
}

async function backfillTickerIndex() {
    console.log('🔄 Backfilling ticker index...\n');

    // Get all users
    const users = await redis.smembers('all_users') as string[];
    console.log(`Found ${users.length} users to process`);

    const tickerCounts = new Map<string, number>();
    let totalAnalyses = 0;

    for (const username of users) {
        const historyKey = `user:history:${username}`;
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history: StoredAnalysis[] = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        for (const analysis of history) {
            const tickerKey = getTickerKey(analysis);
            const indexKey = `${TICKER_INDEX_PREFIX}${tickerKey}`;
            const analysisRef = `${username}:${analysis.id}`;

            // Add to global ticker set
            await redis.sadd(TRACKED_TICKERS_KEY, tickerKey);

            // Add to ticker's analysis index
            await redis.sadd(indexKey, analysisRef);

            // Track for stats
            tickerCounts.set(tickerKey, (tickerCounts.get(tickerKey) || 0) + 1);
            totalAnalyses++;
        }
    }

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Total analyses indexed: ${totalAnalyses}`);
    console.log(`   Unique tickers tracked: ${tickerCounts.size}`);
    console.log(`\n📊 Top 10 tickers by count:`);

    const sorted = [...tickerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [ticker, count] of sorted) {
        console.log(`   ${ticker}: ${count} analyses`);
    }

    process.exit(0);
}

backfillTickerIndex();
