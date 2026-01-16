
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const TWEET_ID = '2011451167965127019';
const USERNAME = 'trader1sz';

async function removeAnalysis(key: string, id: string) {
    const list = await redis.lrange(key, 0, -1);
    const initialLen = list.length;
    console.log(`Checking ${key}: ${initialLen} items found`);
    const filtered = list.filter((item) => {
        const p = typeof item === 'string' ? JSON.parse(item) : item;
        const match = p.id === id;
        if (match) console.log(`Found match in ${key}`);
        return !match;
    });

    if (filtered.length < initialLen) {
        console.log(`Deleting and rewriting ${key} with ${filtered.length} items...`);
        await redis.del(key);
        // Push back in reverse order to maintain correct order (lpush reverses)
        if (filtered.length > 0) {
            // We need to push from right to left if we used lrange 0,-1?
            // lrange returns [newest, ..., oldest]
            // to rebuild with lpush, we iterate from oldest (last) to newest (first)
            for (let i = filtered.length - 1; i >= 0; i--) {
                const item = filtered[i];
                await redis.lpush(key, typeof item === 'string' ? item : JSON.stringify(item));
            }
        }
        console.log(`✅ Removed ${id} from ${key}.`);
    } else {
        console.log(`ℹ️ ${id} not found in ${key}.`);
    }
}

async function main() {
    console.log(`🗑️ Removing Tweet ${TWEET_ID}...`);

    await removeAnalysis('recent_analyses', TWEET_ID);
    await removeAnalysis(`user:history:${USERNAME}`, TWEET_ID);

    console.log('Done.');
    process.exit(0);
}

main();
