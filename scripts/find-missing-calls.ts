
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

/**
 * find-missing-calls.ts
 * 
 * Deep-scans Upstash to find why the global index (28,622) 
 * doesn't match the sum of user histories (25,935).
 */

dotenv.config({ path: path.resolve(process.cwd(), '.env.production.local'), override: true });

const SOURCE_URL = process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL || '';
const SOURCE_TOKEN = process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN || '';

if (!SOURCE_URL || !SOURCE_TOKEN) {
    console.error('❌ Upstash credentials missing in .env.production.local');
    process.exit(1);
}

async function scan() {
    const redis = new Redis({ url: SOURCE_URL, token: SOURCE_TOKEN });

    console.log('📊 FETCHING GLOBAL INDEX...');
    const globalRefs = await redis.zrange('global:analyses:timestamp', 0, -1) as string[];
    console.log(`   Global Index Count: ${globalRefs.length}`);

    console.log('👤 FETCHING ALL USERS SET...');
    const allUsers = new Set((await redis.smembers('all_users') as string[]).map(u => u.toLowerCase()));
    console.log(`   all_users Set Count: ${allUsers.size}`);

    const usersInIndex = new Set<string>();
    globalRefs.forEach(ref => {
        const username = ref.split(':')[0].toLowerCase();
        usersInIndex.add(username);
    });
    console.log(`   Users found in Global Index: ${usersInIndex.size}`);

    // Find users in index NOT in all_users
    const missingFromAllUsers = Array.from(usersInIndex).filter(u => !allUsers.has(u));
    console.log(`⚠️  Users in Index but MISSING from all_users: ${missingFromAllUsers.length}`);
    if (missingFromAllUsers.length > 0) {
        console.log(`   Sample: ${missingFromAllUsers.slice(0, 5).join(', ')}`);
    }

    // Check history sizes for a sample of users
    console.log('\n🧐 CHECKING HISTORY CONSISTENCY...');
    let totalInHistories = 0;
    const usernames = Array.from(usersInIndex);
    
    // Check first 100 users for drift
    for (let i = 0; i < Math.min(usernames.length, 100); i++) {
        const user = usernames[i];
        const historyLen = await redis.llen(`user:history:${user}`);
        const refsInIndex = globalRefs.filter(ref => ref.startsWith(`${user}:`)).length;
        
        if (historyLen !== refsInIndex) {
            console.log(`❌ DRIFT for @${user}: Index=${refsInIndex}, History=${historyLen}`);
        }
    }

    console.log('\n✅ Scan complete.');
}

scan();
