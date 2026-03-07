import { getRedisClient } from '../src/lib/redis-client';
import { dualWrite, recalculateUserProfile } from '../src/lib/analysis-store';
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
    const redis = getRedisClient();
    const allUsers = await redis.smembers('all_users');

    console.log(`Checking ${allUsers.length} users for duplicate history items...`);

    let corruptedUsers = 0;

    for (const user of allUsers) {
        const username = user.toLowerCase();
        const historyData = await redis.lrange(`user:history:${username}`, 0, -1);
        if (historyData.length === 0) continue;

        const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
        const uniqueHistoryMap = new Map<string, any>();
        let duplicates = 0;

        for (const item of history) {
            if (uniqueHistoryMap.has(item.id)) {
                duplicates++;
            }
            uniqueHistoryMap.set(item.id, item);
        }

        if (duplicates > 0) {
            console.log(`\nUser @${username} has ${duplicates} duplicates! (Total: ${history.length}, Unique: ${uniqueHistoryMap.size})`);
            corruptedUsers++;

            const cleanHistory = Array.from(uniqueHistoryMap.values());

            // Use dualWrite to ensure both primary and production are cleaned atomically
            await dualWrite(async (r) => {
                await r.del(`user:history:${username}`);
                if (cleanHistory.length > 0) {
                    const pipe = r.pipeline();
                    for (let i = cleanHistory.length - 1; i >= 0; i--) {
                        pipe.lpush(`user:history:${username}`, JSON.stringify(cleanHistory[i]));
                    }
                    await pipe.exec();
                }
            });
            console.log(`  - Wrote ${cleanHistory.length} unique items via dualWrite`);

            // Recalculate profile (reads from primary, writes via dualWrite)
            await recalculateUserProfile(username);

            // Verify
            const verifyData = await redis.lrange(`user:history:${username}`, 0, -1);
            console.log(`  - Verified: ${verifyData.length} items in primary`);
        }
    }

    console.log(`\nFixed ${corruptedUsers} users with corrupted/duplicate data.`);

    // Clear caches
    console.log('Clearing caches...');
    await redis.del('platform_metrics');

    process.exit(0);
}

main().catch(console.error);
