import { getRedisClient } from '../src/lib/redis-client';
import { StoredAnalysis } from '../src/lib/analysis-store';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkTweets(ids: string[]) {
    const redis = getRedisClient();
    const users = await redis.smembers('all_users');
    console.log(`Searching for tweets in ${users.length} users...`);

    for (const user of users) {
        const history = await redis.lrange(`user:history:${user}`, 0, -1);
        for (const itemStr of history) {
            const item = typeof itemStr === 'string' ? JSON.parse(itemStr) : itemStr;
            if (ids.includes(item.id)) {
                console.log(`--- FOUND ---`);
                console.log(`User: ${user}`);
                console.log(`ID: ${item.id}`);
                console.log(`Symbol: ${item.symbol}`);
                console.log(`Sentiment: ${item.sentiment}`);
                console.log(`Text: ${item.text}`);
            }
        }
    }
}

const ids = ['2020960150346138071', '2019863281926627607'];
checkTweets(ids).catch(console.error);
