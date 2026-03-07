import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const redis = new Redis({
    url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

async function migrate() {
    console.log("Fetching all global analyses...");
    const all = await redis.zrange('global:analyses:timestamp', 0, -1, { withScores: true }) as any[];
    console.log(`Found ${all.length / 2} items.`);

    let count = 0;
    const pipeline = redis.pipeline();
    const users = new Set<string>();

    for (let i = 0; i < all.length; i += 2) {
        const member = all[i];
        const score = all[i + 1];
        const [username, id] = member.split(':');
        const lowerUser = username.toLowerCase();
        pipeline.zadd(`user_index:${lowerUser}`, { score, member });
        users.add(lowerUser);
        count++;
        if (count % 500 === 0) {
            await pipeline.exec();
            console.log(`Processed ${count}...`);
        }
    }
    if (count % 500 !== 0) {
        await pipeline.exec();
    }
    console.log(`Migrated ${count} analyses across ${users.size} users into user_index:*`);
    process.exit(0);
}

migrate().catch(console.error);
