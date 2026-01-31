import * as dotenv from 'dotenv';
import * as path from 'path';
import { getRedisClient } from '../src/lib/redis-client';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const redis = getRedisClient();

async function debugBTCSentiment() {
    console.log('🔍 Debugging BTC Sentiment...');

    const recentRefs = await redis.zrange('global:analyses:timestamp', 0, 199, { rev: true }) as string[];
    console.log(`Fetched ${recentRefs.length} global refs.`);

    const userMap: Record<string, Set<string>> = {};
    recentRefs.forEach(ref => {
        const [user, id] = ref.split(':');
        if (!userMap[user]) userMap[user] = new Set();
        userMap[user].add(id);
    });

    let btcBullish = 0;
    let btcBearish = 0;
    let btcTotal = 0;

    for (const user of Object.keys(userMap)) {
        const history = await redis.lrange(`user:history:${user}`, 0, -1);
        const targetIds = userMap[user];

        history.forEach(item => {
            const p = typeof item === 'string' ? JSON.parse(item) : item;
            if (targetIds.has(String(p.id))) {
                if (p.symbol && p.symbol.toUpperCase() === 'BTC') {
                    btcTotal++;
                    if (p.sentiment === 'BULLISH') btcBullish++;
                    else btcBearish++;
                    console.log(`[BTC] User: @${user}, Sentiment: ${p.sentiment}, ID: ${p.id}`);
                }
            }
        });
    }

    console.log(`\n--- FINAL BTC DEBUG STATS (Last 200 Global) ---`);
    console.log(`Total BTC Calls: ${btcTotal}`);
    console.log(`Bullish: ${btcBullish}`);
    console.log(`Bearish: ${btcBearish}`);
    if (btcTotal > 0) {
        console.log(`Bullish %: ${((btcBullish / btcTotal) * 100).toFixed(1)}%`);
    }

    process.exit(0);
}

debugBTCSentiment();
