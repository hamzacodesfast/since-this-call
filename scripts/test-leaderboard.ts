
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function main() {
    console.log('Fetching leaderboard data...');
    const allUsers = await redis.smembers('all_users');
    console.log(`Found ${allUsers.length} users`);

    const profiles = [];
    for (const username of allUsers) {
        try {
            const profile = await redis.hgetall(`user:profile:${username}`);
            if (profile) {
                // Mimic leaderboard logic
                const p = {
                    ...profile,
                    winRate: parseFloat(profile.winRate as string || '0'),
                    totalAnalyses: parseInt(profile.totalAnalyses as string || '0'),
                    wins: parseInt(profile.wins as string || '0'),
                    losses: parseInt(profile.losses as string || '0'),
                    avgPerformance: parseFloat(profile.avgPerformance as string || '0'),
                };
                profiles.push(p);
            }
        } catch (e) {
            console.error(`Error fetching/parsing ${username}:`, e);
        }
    }

    console.log(`Fetched ${profiles.length} profiles`);

    // Sort
    profiles.sort((a, b) => b.winRate - a.winRate);
    console.log('Sorted by winRate success');

    // Check for NaNs
    const nans = profiles.filter(p => isNaN(p.winRate) || isNaN(p.avgPerformance));
    if (nans.length > 0) {
        console.error('Found NaNs:', nans.slice(0, 3));
    } else {
        console.log('No NaNs found in parsed data.');
    }
}

main().catch(console.error);
