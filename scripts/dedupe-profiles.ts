
import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
    const { recalculateUserProfile } = await import('../src/lib/analysis-store');
    const redis = getRedisClient();
    console.log('🧹 Starting deduplication cleanup...');

    const users = await redis.smembers('all_users');
    let totalFixed = 0;
    let usersFixed = 0;

    for (const user of users) {
        const historyKey = `user:history:${user}`;
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);

        const seen = new Set();
        const uniqueHistory: any[] = [];
        let duplicatesFound = 0;

        for (const item of history) {
            if (seen.has(item.id)) {
                duplicatesFound++;
            } else {
                seen.add(item.id);
                uniqueHistory.push(item);
            }
        }

        if (duplicatesFound > 0) {
            console.log(`\n👤 Fixing ${user}: Found ${duplicatesFound} duplicates`);

            // Rewrite history
            await redis.del(historyKey);
            // Reverse loop to keep chronological order if using lpush
            // uniqueHistory has originals (from top/bottom depending on scan)
            // history was lrange 0 -1 (top to bottom).
            // uniqueHistory preserves top-first order.
            // lpush needs bottom-to-top to reconstruct correctly.
            for (let i = uniqueHistory.length - 1; i >= 0; i--) {
                await redis.lpush(historyKey, JSON.stringify(uniqueHistory[i]));
            }

            // Recalculate stats to fix counts
            await recalculateUserProfile(user);

            totalFixed += duplicatesFound;
            usersFixed++;
            console.log(`   ✅ Fixed.`);
        }
    }

    console.log(`\n✨ Cleanup complete.`);
    console.log(`   Users Fixed: ${usersFixed}`);
    console.log(`   Duplicates Removed: ${totalFixed}`);
    process.exit(0);
}

main();
