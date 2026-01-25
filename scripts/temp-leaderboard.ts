
import * as dotenv from 'dotenv';
import * as path from 'path';
import { getRedisClient } from '../src/lib/redis-client';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function getLeaderboard() {
    const redis = getRedisClient();
    const users = await redis.smembers('all_users');
    const profiles = [];

    for (const user of users) {
        const profile = await redis.hgetall(`user:profile:${user}`);
        if (profile && parseInt(profile.totalAnalyses) >= 3) {
            profiles.push({
                username: user,
                winRate: parseFloat(profile.winRate),
                total: parseInt(profile.totalAnalyses),
                wins: parseInt(profile.wins),
                losses: parseInt(profile.losses)
            });
        }
    }

    const sorted = profiles.sort((a, b) => b.winRate - a.winRate);

    console.log('🏆 TOP 5 GURUS:');
    sorted.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. @${p.username} - ${p.winRate.toFixed(1)}% (${p.total} calls)`);
    });

    console.log('\n📉 BOTTOM 5 GURUS:');
    sorted.slice(-5).reverse().forEach((p, i) => {
        console.log(`${i + 1}. @${p.username} - ${p.winRate.toFixed(1)}% (${p.total} calls)`);
    });

    process.exit(0);
}

getLeaderboard();
