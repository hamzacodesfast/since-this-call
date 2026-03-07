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

    const username = 'longinvest32';

    const historyData = await redis.lrange(`user:history:${username}`, 0, -1) as any[];
    const profile = await redis.hgetall(`user:profile:${username}`) as any;

    if (!historyData || historyData.length === 0) {
        console.log(`@${username}: no history found`);
        process.exit(0);
    }

    const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);

    // Check for dupes in list
    const uniqueMap = new Map<string, any>();
    for (const item of history) {
        uniqueMap.set(item.id, item);
    }
    const hasDupes = uniqueMap.size < history.length;

    // Check if profile totalAnalyses matches actual history length
    const profileTotal = parseInt(profile?.totalAnalyses || '0');
    const actualUnique = uniqueMap.size;

    console.log(`@${username}:`);
    console.log(`  List Length: ${history.length}`);
    console.log(`  Unique IDs: ${uniqueMap.size}`);
    console.log(`  Has Dupes: ${hasDupes}`);
    console.log(`  Profile Hash totalAnalyses: ${profileTotal}`);
    
    if (hasDupes) {
        console.log(`\n  Duplicates found! ${history.length - uniqueMap.size} extra entries in list.`);
    }
    if (profileTotal !== actualUnique) {
        console.log(`\n  Profile mismatch! Hash says ${profileTotal}, actually ${actualUnique}.`);
    }

    if (!hasDupes && profileTotal === actualUnique) {
        console.log(`\n  Profile is clean and accurate.`);
    }

    process.exit(0);
}
main().catch(console.error);
