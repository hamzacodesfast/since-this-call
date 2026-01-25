
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Prod Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function checkPeter() {
    const { getRedisClient } = await import('../src/lib/redis-client');
    const redis = getRedisClient();

    const username = 'peterlbrandt';
    const historyKey = `user:history:${username}`;

    console.log(`Checking history for ${username}...`);
    const historyData = await redis.lrange(historyKey, 0, 5); // Just top 5
    const history = historyData.map((s: any) => typeof s === 'string' ? JSON.parse(s) : s);

    for (const h of history) {
        console.log(`\nID: ${h.id}`);
        console.log(`Symbol: ${h.symbol}`);
        console.log(`Timestamp: ${h.timestamp} -> ${new Date(h.timestamp).toISOString()}`);
        console.log(`Text: ${h.text ? h.text.substring(0, 50) : 'N/A'}...`);
    }

    process.exit(0);
}

checkPeter();
