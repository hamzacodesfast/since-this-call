
import * as dotenv from 'dotenv';
import * as path from 'path';
import { getRedisClient } from '../src/lib/redis-client';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const redis = getRedisClient();

async function reproduceMetrics() {
    console.log('🧪 Reproducing Metrics Aggregation...');

    const allUsers = await redis.smembers('all_users') as string[];
    console.log(`Total Users: ${allUsers.length}`);

    const GLOBAL_ANALYSES_ZSET = 'global:analyses:timestamp';
    const recentRefs = await redis.zrange(GLOBAL_ANALYSES_ZSET, 0, 499, { rev: true }) as string[];
    console.log(`Included Refs: ${recentRefs.length}`);

    const userMap: Record<string, Set<string>> = {};
    recentRefs.forEach(ref => {
        const [user, id] = ref.split(':');
        if (!userMap[user]) userMap[user] = new Set();
        userMap[user].add(id);
    });

    const usersInSample = Object.keys(userMap);
    const tickerMap: Record<string, any> = {};

    for (const user of usersInSample) {
        const historyData = await redis.lrange(`user:history:${user}`, 0, -1);
        const targetIds = userMap[user];

        let userMatched = 0;

        historyData.forEach(item => {
            const p = typeof item === 'string' ? JSON.parse(item) : item;
            if (targetIds.has(String(p.id))) {
                userMatched++;
                const symbol = p.symbol || 'UNKNOWN';
                const tickerKey = p.contractAddress && p.contractAddress.length > 10
                    ? `CA:${p.contractAddress}`
                    : `${p.type || 'CRYPTO'}:${symbol}`;

                if (!tickerMap[tickerKey]) {
                    tickerMap[tickerKey] = { symbol, callCount: 0, bullish: 0, bearish: 0 };
                }

                const stats = tickerMap[tickerKey];
                stats.callCount++;
                if (p.sentiment === 'BULLISH') stats.bullish++;
                else stats.bearish++;
            }
        });

        // console.log(`User ${user}: Matched ${userMatched}/${targetIds.size}`);
    }

    const btc = tickerMap['CRYPTO:BTC'];
    if (btc) {
        console.log(`BTC Result:`, btc);
        console.log(`Sum of Bullish/Bearish: ${btc.bullish + btc.bearish}`);
    } else {
        console.log('BTC not found in top 500 window');
    }

    process.exit(0);
}

reproduceMetrics();
