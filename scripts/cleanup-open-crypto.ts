
import * as dotenv from 'dotenv';
import * as path from 'path';

// Force Production Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function cleanupOpenCrypto() {
    console.log('🧹 Cleaning up stale CRYPTO:OPEN keys...');

    const { getRedisClient } = await import('../src/lib/redis-client');
    const redis = getRedisClient();

    const tickerKey = 'CRYPTO:OPEN';
    const profileKey = `ticker:profile:${tickerKey}`;
    const indexKey = `ticker_index:${tickerKey}`;
    const trackedTickersKey = 'tracked_tickers';

    try {
        // 1. Delete Profile
        const profile = await redis.hgetall(profileKey);
        if (profile) {
            console.log('Found stale profile, deleting:', profileKey);
            await redis.del(profileKey);
        } else {
            console.log('No profile found at', profileKey);
        }

        // 2. Delete Index
        const indexExists = await redis.exists(indexKey);
        if (indexExists) {
            console.log('Found stale index, deleting:', indexKey);
            await redis.del(indexKey);
        } else {
            console.log('No index found at', indexKey);
        }

        // 3. Remove from Tracked Tickers
        const removed = await redis.srem(trackedTickersKey, tickerKey);
        if (removed) {
            console.log(`Removed ${tickerKey} from ${trackedTickersKey}`);
        } else {
            console.log(`${tickerKey} was not in ${trackedTickersKey}`);
        }

        console.log('✅ Cleanup complete.');

    } catch (e) {
        console.error('Cleanup failed:', e);
    }

    process.exit(0);
}

cleanupOpenCrypto();
