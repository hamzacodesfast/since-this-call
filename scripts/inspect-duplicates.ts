
import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
    const redis = getRedisClient();
    console.log('🔍 Scanning for duplicate tweets in user profiles...');

    const users = await redis.smembers('all_users');
    let totalDups = 0;

    for (const user of users) {
        const historyKey = `user:history:${user}`;
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);

        const seen = new Map();
        const duplicates = [];

        for (const item of history) {
            if (seen.has(item.id)) {
                duplicates.push({
                    original: seen.get(item.id),
                    duplicate: item
                });
            } else {
                seen.set(item.id, item);
            }
        }

        if (duplicates.length > 0) {
            console.log(`\n👤 User: ${user} has ${duplicates.length} duplicates`);
            duplicates.forEach(d => {
                console.log(`   🔸 ID: ${d.duplicate.id}`);
                console.log(`      Type seen: ${typeof d.original.id}, Type dup: ${typeof d.duplicate.id}`);
                console.log(`      Val seen: "${d.original.id}", Val dup: "${d.duplicate.id}"`);
            });
            totalDups += duplicates.length;
        }
    }

    console.log(`\n✅ Scan complete. Found ${totalDups} total duplicates.`);
    process.exit(0);
}

main();
