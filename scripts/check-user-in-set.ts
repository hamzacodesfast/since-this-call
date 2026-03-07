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
    
    const isMember = await redis.sismember('all_users', 'longinvest32');
    const allUsers = await redis.smembers('all_users');
    console.log(`Is longinvest32 in all_users? ${isMember}`);
    console.log(`Total users in set: ${allUsers.length}`);
    
    // Check if the history list exists
    const len = await redis.llen('user:history:longinvest32');
    console.log(`History length: ${len}`);
    process.exit(0);
}
main().catch(console.error);
