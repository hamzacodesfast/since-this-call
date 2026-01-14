
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function main() {
    console.log('📊 Auditing Recovery Status...\n');

    const users = await redis.smembers('all_users');
    console.log(`Found ${users.length} Users with Active Profiles:`);

    const audit = [];

    for (const user of users) {
        const historyKey = `user:history:${user}`;
        const len = await redis.llen(historyKey);
        audit.push({ user, count: len });
    }

    // Sort by count
    audit.sort((a, b) => b.count - a.count);

    for (const a of audit) {
        console.log(`- @${a.user}: ${a.count} tweets`);
    }

    console.log('\nTotal Tweets in System:', audit.reduce((a, b) => a + b.count, 0));
}

main();
