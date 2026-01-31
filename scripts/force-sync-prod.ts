
import { Redis } from '@upstash/redis';

// Explicitly define Production Credentials
const PROD_URL = "https://moved-fox-21819.upstash.io";
const PROD_TOKEN = "AVU7AAIncDI5OTczMmI0NWQ3NjE0NTRiOWY2NTAzZmUyMjFiOGU0ZHAyMjE4MTk";

const redis = new Redis({
    url: PROD_URL,
    token: PROD_TOKEN,
});

async function forceSyncProd() {
    console.log('🔄 FORCE SYNCING PRODUCTION PROFILES...');
    console.log(`Target: ${PROD_URL}`);

    const users = await redis.smembers('all_users') as string[];
    console.log(`Found ${users.length} users to sync.`);

    let count = 0;
    for (const username of users) {
        const lowerUser = username.toLowerCase();
        const profileKey = `user:profile:${lowerUser}`;
        const historyKey = `user:history:${lowerUser}`;

        // Get actual history length
        const historyLen = await redis.llen(historyKey);

        // Read history to calculate wins/losses
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

        const winRate = historyLen > 0 ? (wins / historyLen) * 100 : 0;

        // Update Profile
        // We use hset to update stats but keep other fields like avatar if possible
        // Actually, let's just update the stats fields to be safe
        await redis.hset(profileKey, {
            totalAnalyses: historyLen,
            wins,
            losses,
            neutral,
            winRate,
            lastAnalyzed: Date.now()
        });

        count++;
        if (count % 50 === 0) process.stdout.write('.');
    }

    console.log('\n✅ Profile Sync Complete.');

    console.log('Clearing cache...');
    await redis.del('platform_metrics');

    console.log('Verifying total sum...');
    let sum = 0;
    for (const u of users) {
        const pr = await redis.hget(`user:profile:${u}`, 'totalAnalyses') as string;
        sum += parseInt(pr || '0');
    }
    console.log(`New Total Analyses Sum: ${sum}`);

    process.exit(0);
}

forceSyncProd().catch(console.error);
