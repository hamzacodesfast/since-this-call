
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.production' });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const IDs = [
    '2012873625666301955',
    '2017323672500113886',
    '2016988540744454279',
    '2016249140855156962',
    '2017511223471051078',
    '2017609267734552883'
];

async function findUsers() {
    const allUsers = await redis.smembers('all_users');
    console.log(`Searching through ${allUsers.length} users...`);

    for (const id of IDs) {
        let found = false;
        for (const user of allUsers) {
            const history = await redis.lrange(`user:history:${user}`, 0, -1);
            const match = history.find((item: any) => {
                const parsed = typeof item === 'string' ? JSON.parse(item) : item;
                return parsed.id === id;
            });
            if (match) {
                console.log(`✅ Tweet ${id} found for user: ${user}`);
                found = true;
                break;
            }
        }
        if (!found) {
            console.log(`❌ Tweet ${id} NOT found in any history.`);
        }
    }
}

findUsers().catch(console.error);
