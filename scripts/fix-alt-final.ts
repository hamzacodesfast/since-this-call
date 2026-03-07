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
    const username = 'altcoindaily';

    // 1. Read & deduplicate list
    const historyData = await redis.lrange(`user:history:${username}`, 0, -1);
    const history = (historyData as any[]).map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
    console.log(`Current list length: ${history.length}`);

    const uniqueMap = new Map<string, any>();
    for (const item of history) {
        uniqueMap.set(item.id, item);
    }
    const cleanHistory = Array.from(uniqueMap.values());
    console.log(`Unique items: ${cleanHistory.length}`);

    // 2. Overwrite list atomically
    await redis.del(`user:history:${username}`);
    if (cleanHistory.length > 0) {
        const pipe = redis.pipeline();
        for (let i = cleanHistory.length - 1; i >= 0; i--) {
            pipe.lpush(`user:history:${username}`, JSON.stringify(cleanHistory[i]));
        }
        await pipe.exec();
    }

    // 3. Verify list
    const verifyLen = await redis.llen(`user:history:${username}`);
    console.log(`Verified list length: ${verifyLen}`);

    // 4. Recalculate and write profile
    let wins = 0, losses = 0, neutral = 0;
    for (const item of cleanHistory) {
        if (Math.abs(item.performance) < 0.01) neutral++;
        else if (item.isWin) wins++;
        else losses++;
    }
    const winRate = cleanHistory.length > 0 ? (wins / cleanHistory.length) * 100 : 0;

    const existingProfile = await redis.hgetall(`user:profile:${username}`) as any;
    await redis.hset(`user:profile:${username}`, {
        username: existingProfile?.username || 'AltcoinDaily',
        avatar: existingProfile?.avatar || '',
        totalAnalyses: cleanHistory.length,
        wins, losses, neutral, winRate,
        lastAnalyzed: Date.now(),
        isVerified: existingProfile?.isVerified === 'true' || existingProfile?.isVerified === true,
    });

    // 5. Final verify
    const finalProfile = await redis.hgetall(`user:profile:${username}`) as any;
    console.log(`\nFinal profile: ${finalProfile.totalAnalyses} calls (${finalProfile.wins}W/${finalProfile.losses}L) ${parseFloat(finalProfile.winRate).toFixed(1)}% WR`);

    await redis.del('platform_metrics');
    process.exit(0);
}
main().catch(console.error);
