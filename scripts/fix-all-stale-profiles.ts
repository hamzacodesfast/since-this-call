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

    const allUsers = await redis.smembers('all_users') as string[];
    console.log(`Checking ${allUsers.length} users for profile/history mismatches...`);

    let fixedCount = 0;
    let dupeCount = 0;

    for (const user of allUsers) {
        const username = user.toLowerCase();
        const historyData = await redis.lrange(`user:history:${username}`, 0, -1) as any[];
        const profile = await redis.hgetall(`user:profile:${username}`) as any;

        if (!historyData || historyData.length === 0) continue;

        const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);

        // Check for dupes in list
        const uniqueMap = new Map<string, any>();
        for (const item of history) uniqueMap.set(item.id, item);
        const hasDupes = uniqueMap.size < history.length;

        // Check if profile totalAnalyses matches actual history length
        const profileTotal = parseInt(profile?.totalAnalyses || '0');
        const actualUnique = uniqueMap.size;

        if (hasDupes || profileTotal !== actualUnique) {
            const cleanHistory = Array.from(uniqueMap.values());

            if (hasDupes) {
                console.log(`\n@${username}: LIST has dupes (${history.length} -> ${cleanHistory.length})`);
                dupeCount++;
                // Fix list
                await redis.del(`user:history:${username}`);
                const pipe = redis.pipeline();
                for (let i = cleanHistory.length - 1; i >= 0; i--) {
                    pipe.lpush(`user:history:${username}`, JSON.stringify(cleanHistory[i]));
                }
                await pipe.exec();
            }

            if (profileTotal !== actualUnique) {
                console.log(`${hasDupes ? '' : '\n'}@${username}: PROFILE mismatch (hash=${profileTotal}, actual=${actualUnique})`);
            }

            // Recalc stats
            let wins = 0, losses = 0, neutral = 0;
            for (const item of cleanHistory) {
                if (Math.abs(item.performance) < 0.01) neutral++;
                else if (item.isWin) wins++;
                else losses++;
            }
            const winRate = cleanHistory.length > 0 ? (wins / cleanHistory.length) * 100 : 0;

            await redis.hset(`user:profile:${username}`, {
                username: profile?.username || username,
                avatar: profile?.avatar || '',
                totalAnalyses: cleanHistory.length,
                wins, losses, neutral, winRate,
                lastAnalyzed: Date.now(),
                isVerified: profile?.isVerified === 'true' || profile?.isVerified === true,
            });
            console.log(`  -> Fixed: ${cleanHistory.length} calls (${wins}W/${losses}L)`);
            fixedCount++;
        }
    }

    console.log(`\nDone! Fixed ${fixedCount} profiles (${dupeCount} had list dupes).`);
    await redis.del('platform_metrics');
    process.exit(0);
}
main().catch(console.error);
