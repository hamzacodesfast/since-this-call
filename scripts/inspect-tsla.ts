
import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
    const redis = getRedisClient();
    const symbolToFind = (process.argv[2] || 'TSLA').toUpperCase();

    console.log(`🔍 Inspecting all users for symbol: ${symbolToFind}...`);

    const users = await redis.smembers('all_users');
    let totalFound = 0;
    const foundDetails: any[] = [];

    for (const user of users) {
        const history = await redis.lrange(`user:history:${user}`, 0, -1);
        const parsed = history.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);

        const matches = parsed.filter((a: any) => a.symbol === symbolToFind || a.symbol?.toUpperCase() === symbolToFind);

        if (matches.length > 0) {
            totalFound += matches.length;
            matches.forEach((m: any) => {
                foundDetails.push({
                    user,
                    id: m.id,
                    date: new Date(m.timestamp || 0).toISOString(),
                    type: m.type
                });
            });
        }
    }

    console.log('\nResults:');
    foundDetails.forEach(d => {
        console.log(`- @${d.user}: ${d.id} (${d.date}) [${d.type}]`);
    });

    console.log(`\nTotal ${symbolToFind} calls found in DB: ${totalFound}`);
    process.exit(0);
}

main();
