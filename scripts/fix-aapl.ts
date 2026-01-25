
import * as dotenv from 'dotenv';
import * as path from 'path';

// 1. Load Env Vars (TARGET PRODUCTION)
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
// Fallback to local if prod missing (safety)
if (!process.env.UPSTASH_REDIS_REST_KV_REST_API_URL) {
    console.warn('⚠️ Key missing, falling back to local...');
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}

async function fixAAPL() {
    console.log('🍏 Inspecting AAPL Analyses...');

    // 2. Dynamic Import ensures env vars are active when modules load
    const { getRedisClient } = await import('../src/lib/redis-client');
    const { refreshUser } = await import('../src/lib/price-updater');

    const redis = getRedisClient();

    // 1. Find users who called AAPL
    const stockKey = 'ticker_index:STOCK:AAPL';
    const cryptoKey = 'ticker_index:CRYPTO:AAPL';

    const stockRefs = await redis.smembers(stockKey) || [];
    const cryptoRefs = await redis.smembers(cryptoKey) || [];

    console.log(`Found ${stockRefs.length} STOCK refs and ${cryptoRefs.length} CRYPTO refs for AAPL.`);

    const allRefs = [...stockRefs, ...cryptoRefs];
    const usersToRefresh = new Set<string>();

    for (const ref of allRefs) {
        if (typeof ref === 'string') {
            const [username] = ref.split(':');
            if (username) usersToRefresh.add(username);
        }
    }

    console.log(`Found ${usersToRefresh.size} unique users with AAPL calls.`);

    // 2. Refresh these users
    for (const user of usersToRefresh) {
        console.log(`Refreshing profile for ${user} to fix AAPL...`);
        await refreshUser(user, true); // Force refresh
    }

    if (cryptoRefs.length > 0) {
        console.log('Cleaning up misclassified CRYPTO:AAPL index...');
        // Optional cleanup
    }

    console.log('Done.');
    process.exit(0);
}

fixAAPL();
