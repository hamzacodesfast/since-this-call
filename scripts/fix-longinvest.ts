import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
        token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
    });

    const username = 'longinvest32';

    const historyData = await redis.lrange(`user:history:${username}`, 0, -1) as any[];
    const profile = await redis.hgetall(`user:profile:${username}`) as any;

    if (!historyData || historyData.length === 0) {
        console.log(`@${username}: no history found`);
        process.exit(0);
    }

    const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);

    // Deduplicate
    const uniqueMap = new Map<string, any>();
    for (const item of history) {
        uniqueMap.set(item.id, item);
    }
    const cleanHistory = Array.from(uniqueMap.values());
    const hasDupes = cleanHistory.length < history.length;

    const profileTotal = parseInt(profile?.totalAnalyses || '0');

    if (hasDupes) {
        console.log(`@${username}: LIST dupes (${history.length} -> ${cleanHistory.length}), fixing...`);
        await redis.del(`user:history:${username}`);
        const pipe = redis.pipeline();
        for (let i = cleanHistory.length - 1; i >= 0; i--) {
            pipe.lpush(`user:history:${username}`, JSON.stringify(cleanHistory[i]));
        }
        await pipe.exec();
    }

    // Recalc stats
    let wins = 0, losses = 0, neutral = 0;
    for (const item of cleanHistory) {
        if (Math.abs(item.performance) < 0.01) neutral++;
        else if (item.isWin) wins++;
        else losses++;
    }
    const winRate = cleanHistory.length > 0 ? (wins / cleanHistory.length) * 100 : 0;

    if (profileTotal !== cleanHistory.length || hasDupes) {
        await redis.hset(`user:profile:${username}`, {
            username: profile?.username || username,
            avatar: profile?.avatar || '',
            totalAnalyses: cleanHistory.length,
            wins, losses, neutral, winRate,
            lastAnalyzed: Date.now(),
            isVerified: profile?.isVerified === 'true' || profile?.isVerified === true,
        });
        console.log(`@${username}: FIXED hash ${profileTotal} -> ${cleanHistory.length} (${wins}W/${losses}L)`);
    } else {
        console.log(`@${username}: OK (${cleanHistory.length} calls, hash matches)`);
    }

    await redis.del('platform_metrics');
    process.exit(0);
}
main().catch(console.error);
