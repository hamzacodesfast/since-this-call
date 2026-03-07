import { getRedisClient } from '../src/lib/redis-client';
import { dualWrite } from '../src/lib/analysis-store';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
    const redis = getRedisClient();
    const username = 'altcoindaily';

    const historyData = await redis.lrange(`user:history:${username}`, 0, -1);
    const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
    console.log(`Actual history length: ${history.length}`);

    let wins = 0, losses = 0, neutral = 0;
    for (const item of history) {
        if (Math.abs(item.performance) < 0.01) neutral++;
        else if (item.isWin) wins++;
        else losses++;
    }
    const winRate = history.length > 0 ? (wins / history.length) * 100 : 0;

    const existingProfile = await redis.hgetall(`user:profile:${username}`) as any;
    console.log(`Old profile: ${existingProfile?.totalAnalyses} calls`);
    console.log(`New stats: ${history.length} calls (${wins}W/${losses}L/${neutral}N, ${winRate.toFixed(1)}%)`);

    await dualWrite(async (r) => {
        await r.hset(`user:profile:${username}`, {
            username: existingProfile?.username || 'AltcoinDaily',
            avatar: existingProfile?.avatar || '',
            totalAnalyses: history.length,
            wins, losses, neutral, winRate,
            lastAnalyzed: Date.now(),
            isVerified: existingProfile?.isVerified === 'true' || existingProfile?.isVerified === true,
        });
    });

    const newProfile = await redis.hgetall(`user:profile:${username}`) as any;
    console.log(`\nFixed: ${newProfile.totalAnalyses} calls (${newProfile.wins}W/${newProfile.losses}L)`);
    await redis.del('platform_metrics');
    process.exit(0);
}
main().catch(console.error);
