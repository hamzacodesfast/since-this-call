
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load Env
// Load Env in correct order (Local first)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config();

import { getRedisClient } from '../src/lib/redis-client';

const redis = getRedisClient();

async function rebuildGlobalIndex() {
    console.log('🔄 Rebuilding Global Analysis Index (ZSET)...');

    const GLOBAL_ZSET = 'global:analyses:timestamp';
    await redis.del(GLOBAL_ZSET);

    const users = await redis.smembers('all_users') as string[];
    let count = 0;

    for (const username of users) {
        const historyKey = `user:history:${username.toLowerCase()}`;
        const historyData = await redis.lrange(historyKey, 0, -1);

        if (!historyData || historyData.length === 0) continue;

        const history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        const pipeline = redis.pipeline();
        for (const analysis of history) {
            const ref = `${username.toLowerCase()}:${analysis.id}`;
            const timestamp = analysis.timestamp || 0;
            if (timestamp > 0) {
                pipeline.zadd(GLOBAL_ZSET, { score: timestamp, member: ref });
                count++;
            }
        }
        await pipeline.exec();
    }

    console.log(`✅ Rebuild Complete. Indexed ${count} calls into ${GLOBAL_ZSET}.`);
    process.exit(0);
}

rebuildGlobalIndex().catch(console.error);
