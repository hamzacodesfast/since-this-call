
import { getRedisClient } from '../src/lib/redis-client';
import { StoredAnalysisSchema } from '../src/lib/analysis-store';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function purgeCorrupted() {
    const redis = getRedisClient();

    // 1. Purge from recent_analyses
    console.log("🔍 Checking recent_analyses...");
    const recentData = await redis.lrange('recent_analyses', 0, -1);
    const validRecent = [];
    let purgedCount = 0;

    for (const item of recentData) {
        const analysis = typeof item === 'string' ? JSON.parse(item) : item;
        const result = StoredAnalysisSchema.safeParse(analysis);
        if (result.success) {
            validRecent.push(analysis);
        } else {
            console.log(`❌ Purging corrupted ID ${analysis.id || 'unknown'} from recent_analyses`);
            console.log(`   Error: ${JSON.stringify(result.error.issues, null, 2)}`);
            purgedCount++;
        }
    }

    if (purgedCount > 0) {
        await redis.del('recent_analyses');
        for (let i = validRecent.length - 1; i >= 0; i--) {
            await redis.lpush('recent_analyses', JSON.stringify(validRecent[i]));
        }
    }
    console.log(`✅ Purged ${purgedCount} entries from recent_analyses`);

    // 2. Purge from all user histories
    const users = await redis.smembers('all_users');
    for (const user of users) {
        const historyKey = `user:history:${user}`;
        const historyData = await redis.lrange(historyKey, 0, -1);
        const validHistory = [];
        let userPurged = 0;

        for (const item of historyData) {
            const analysis = typeof item === 'string' ? JSON.parse(item) : item;
            const result = StoredAnalysisSchema.safeParse(analysis);
            if (result.success) {
                validHistory.push(analysis);
            } else {
                console.log(`❌ Purging corrupted ID ${analysis.id || 'unknown'} from @${user}'s history`);
                userPurged++;
            }
        }

        if (userPurged > 0) {
            await redis.del(historyKey);
            for (let i = validHistory.length - 1; i >= 0; i--) {
                await redis.lpush(historyKey, JSON.stringify(validHistory[i]));
            }
        }
    }

    console.log("✅ Cleanup complete.");
    process.exit(0);
}

purgeCorrupted();
