
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const RECENT_KEY = 'recent_analyses';
const USER_PROFILE_PREFIX = 'user:profile:';
const ALL_USERS_KEY = 'all_users';
const USER_HISTORY_PREFIX = 'user:history:';

async function backfill() {
    console.log('Fetching all analyses for backfill...');
    const allItems = await redis.lrange(RECENT_KEY, 0, -1);
    console.log(`Found ${allItems.length} analyses.`);

    // 1. Collect all users
    const users = new Set<string>();
    const analyses = allItems.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
    analyses.forEach((a: any) => users.add(a.username.toLowerCase()));

    console.log(`Found ${users.size} unique users. Clearing old profiles...`);

    for (const user of users) {
        await redis.del(`${USER_PROFILE_PREFIX}${user}`);
        await redis.del(`${USER_HISTORY_PREFIX}${user}`);
    }
    // Also clear the global set
    await redis.del(ALL_USERS_KEY);

    console.log('Rebuilding profiles...');

    // 2. Process in order (Oldest to Newest) to build history correctly
    const chronological = analyses.reverse();

    for (const analysis of chronological) {
        await updateUserProfile(analysis);
    }

    console.log('✅ Backfill Complete!');
}


async function updateUserProfile(analysis: any) {
    try {
        const profileKey = `${USER_PROFILE_PREFIX}${analysis.username.toLowerCase()}`;
        const historyKey = `${USER_HISTORY_PREFIX}${analysis.username.toLowerCase()}`;

        // Track user in global set
        await redis.sadd(ALL_USERS_KEY, analysis.username.toLowerCase());

        // Get current history
        const historyData = await redis.lrange(historyKey, 0, -1);
        let history = historyData.map((item: any) =>
            typeof item === 'string' ? JSON.parse(item) : item
        );

        // Check if tweet already exists
        const existingIndex = history.findIndex((h: any) => h.id === analysis.id);

        if (existingIndex !== -1) {
            // Update existing entry
            history[existingIndex] = analysis;
        } else {
            // Add new entry (prepend)
            history.unshift(analysis);
        }

        // Limit history size
        if (history.length > 100) {
            history = history.slice(0, 100);
        }

        // Recalculate Stats from History
        let wins = 0;
        let losses = 0;
        let neutral = 0;
        const total = history.length;

        for (const item of history) {
            if (Math.abs(item.performance) < 0.01) {
                neutral++;
            } else if (item.isWin) {
                wins++;
            } else {
                losses++;
            }
        }

        const winRate = total > 0 ? (wins / total) * 100 : 0;

        await redis.hset(profileKey, {
            username: analysis.username,
            avatar: analysis.avatar || '',
            totalAnalyses: total,
            wins,
            losses,
            neutral,
            winRate,
            lastAnalyzed: Date.now(),
        });

        // Replace History List
        await redis.del(historyKey);
        if (history.length > 0) {
            for (let i = history.length - 1; i >= 0; i--) {
                await redis.lpush(historyKey, JSON.stringify(history[i]));
            }
        }

        process.stdout.write('.');
    } catch (error) {
        console.error('Error updating:', error);
    }
}

backfill();
