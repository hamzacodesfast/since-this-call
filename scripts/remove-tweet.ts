
import * as dotenv from 'dotenv';
import * as path from 'path';
import { getRedisClient } from '../src/lib/redis-client';

// Load Prod Env to match production behavior
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function removeTweet() {
    const tweetId = '2014041861120466980';
    console.log(`🗑️ Removing Tweet ${tweetId}...`);

    const redis = getRedisClient();

    // 1. Remove from Global Recent List
    const analyses = await redis.lrange('analyses:recent', 0, -1);
    const newRecent = [];
    let foundGlobal = false;

    for (const item of analyses) {
        const p = typeof item === 'string' ? JSON.parse(item) : item;
        if (p.id !== tweetId) {
            newRecent.push(item);
        } else {
            foundGlobal = true;
            console.log(`Found in Global List (${p.username}) - Removing`);
        }
    }

    if (foundGlobal) {
        await redis.del('analyses:recent');
        if (newRecent.length > 0) {
            await redis.rpush('analyses:recent', ...newRecent);
        }
        console.log('Global list updated.');
    } else {
        console.log('Not found in global list.');
    }

    // 2. Remove from User History (IncomeSharks)
    // Ideally we would look up the username from the global list, but user said it's IncomeSharks
    const username = 'incomesharks';
    const historyKey = `user:history:${username}`;
    const history = await redis.lrange(historyKey, 0, -1);

    const newHistory = [];
    let foundUser = false;

    for (const item of history) {
        const p = typeof item === 'string' ? JSON.parse(item) : item;
        if (p.id !== tweetId) {
            newHistory.push(item);
        } else {
            foundUser = true;
            console.log(`Found in User History (${username}) - Removing`);
        }
    }

    if (foundUser) {
        await redis.del(historyKey);
        if (newHistory.length > 0) {
            await redis.rpush(historyKey, ...newHistory);
        }
        console.log(`User history for ${username} updated.`);

        // Trigger profile update to recalculate stats
        const { recalculateUserProfile } = await import('../src/lib/analysis-store');
        await recalculateUserProfile(username);
        console.log(`Triggered stats recalculation for ${username}`);
    } else {
        console.log(`Not found in user history for ${username}.`);
    }

    console.log('Done.');
    process.exit(0);
}

removeTweet();
