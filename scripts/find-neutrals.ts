import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

async function main() {
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
        token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
    });

    const username = process.argv[2] || 'mr_derivatives';
    console.log(`Scanning neutrals for ${username}...`);

    const history = await redis.lrange(`user:history:${username.toLowerCase()}`, 0, -1);
    const neutrals = history
        .map((item: any) => typeof item === 'string' ? JSON.parse(item) : item)
        .filter((a: any) => Math.abs(a.performance) < 0.05);

    console.log(`Found ${neutrals.length} neutrals:`);
    neutrals.forEach((n: any) => {
        console.log(`- [${n.id}] ${n.symbol} @ ${n.entryPrice || 0} (${n.text?.substring(0, 50)}...)`);
    });
}

main();
