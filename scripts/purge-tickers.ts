
import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const redis = getRedisClient();

const TICKERS_TO_PURGE = [
    'CRYPTO:USDT-USD',
    'CRYPTO:BTC.D',
    'CRYPTO:WNTV',
    'CRYPTO:TESTICLE',
    'CRYPTO:DRB'
];

const TICKERS_TO_REMAP: Record<string, string> = {
    'CRYPTO:ETHUSD': 'CRYPTO:ETH',
    'CRYPTO:BTCUSD': 'CRYPTO:BTC'
};

async function purgeTickers() {
    console.log('🚀 Starting ticker remapping and purge...');

    for (const [oldKey, newKey] of Object.entries(TICKERS_TO_REMAP)) {
        console.log(`\nRemapping ${oldKey} to ${newKey}...`);
        const oldIndexKey = `ticker_index:${oldKey}`;
        const newIndexKey = `ticker_index:${newKey}`;
        const refs = await redis.zrange(oldIndexKey, 0, -1, { withScores: true });
        console.log(`  Found ${refs.length / 2} references.`);

        const [, newSymbol] = newKey.split(':');

        for (let i = 0; i < refs.length; i += 2) {
            const ref = refs[i] as string;
            const score = refs[i + 1] as number;
            const [username, id] = ref.split(':');

            // Update user history
            const historyKey = `user:history:${username.toLowerCase()}`;
            const historyData = await redis.lrange(historyKey, 0, -1);
            const history = historyData.map((item: any) =>
                typeof item === 'string' ? JSON.parse(item) : item
            );

            for (let item of history) {
                if (item.id === id) {
                    item.symbol = newSymbol;
                    console.log(`  Updated call ${id} for @${username} to ${newSymbol}.`);
                }
            }

            await redis.del(historyKey);
            const pipeline = redis.pipeline();
            for (let i = history.length - 1; i >= 0; i--) {
                pipeline.lpush(historyKey, JSON.stringify(history[i]));
            }
            await pipeline.exec();

            // Move reference in ticker index
            await redis.zrem(oldIndexKey, ref);
            await redis.zadd(newIndexKey, { score, member: ref });
        }

        await redis.srem('tracked_tickers', oldKey);
        await redis.del(oldIndexKey);
        console.log(`  Finished remapping ${oldKey}.`);
    }

    for (const tickerKey of TICKERS_TO_PURGE) {
        console.log(`\nProcessing ${tickerKey}...`);

        // 1. Find all calls for this ticker
        const indexKey = `ticker_index:${tickerKey}`;
        const refs = await redis.zrange(indexKey, 0, -1);
        console.log(`  Found ${refs.length} references.`);

        const affectedUsers = new Set<string>();

        for (const ref of refs as string[]) {
            const [username, id] = ref.split(':');
            affectedUsers.add(username.toLowerCase());

            // 2. Remove from user history
            const historyKey = `user:history:${username.toLowerCase()}`;
            const historyData = await redis.lrange(historyKey, 0, -1);
            const history = historyData.map((item: any) =>
                typeof item === 'string' ? JSON.parse(item) : item
            );

            const newHistory = history.filter((v: any) => v.id !== id);

            if (newHistory.length !== history.length) {
                console.log(`  Removed call ${id} from @${username}'s history.`);
                await redis.del(historyKey);
                if (newHistory.length > 0) {
                    const pipeline = redis.pipeline();
                    for (let i = newHistory.length - 1; i >= 0; i--) {
                        pipeline.lpush(historyKey, JSON.stringify(newHistory[i]));
                    }
                    await pipeline.exec();
                }
            }

            // 3. Remove from recent_analyses if it's there
            const recentData = await redis.lrange('recent_analyses', 0, -1);
            const recent = recentData.map((item: any) =>
                typeof item === 'string' ? JSON.parse(item) : item
            );
            const newRecent = recent.filter((v: any) => v.id !== id);
            if (newRecent.length !== recent.length) {
                console.log(`  Removed call ${id} from recent_analyses.`);
                await redis.del('recent_analyses');
                if (newRecent.length > 0) {
                    const pipeline = redis.pipeline();
                    for (let i = newRecent.length - 1; i >= 0; i--) {
                        pipeline.lpush('recent_analyses', JSON.stringify(newRecent[i]));
                    }
                    await pipeline.exec();
                }
            }
        }

        // 4. Recalculate profiles for affected users
        for (const username of affectedUsers) {
            const historyKey = `user:history:${username}`;
            const historyData = await redis.lrange(historyKey, 0, -1);
            const history = historyData.map((item: any) =>
                typeof item === 'string' ? JSON.parse(item) : item
            );

            let wins = 0;
            let losses = 0;
            let neutral = 0;
            for (const item of history) {
                if (Math.abs(item.performance) < 0.01) neutral++;
                else if (item.isWin) wins++;
                else losses++;
            }
            const winRate = history.length > 0 ? (wins / history.length) * 100 : 0;

            const profileKey = `user:profile:${username}`;
            await redis.hset(profileKey, {
                wins,
                losses,
                neutral,
                winRate,
                totalAnalyses: history.length,
                lastAnalyzed: Date.now()
            });
            console.log(`  Recalculated profile for @${username}.`);
        }

        // 5. Cleanup ticker tracking
        await redis.srem('tracked_tickers', tickerKey);
        await redis.del(indexKey);
        // Also remove ticker stats
        await redis.hdel('ticker_stats', tickerKey);
        console.log(`  Cleaned up ticker tracking for ${tickerKey}.`);
    }

    console.log('\n✅ Purge complete!');
    process.exit(0);
}

purgeTickers();
