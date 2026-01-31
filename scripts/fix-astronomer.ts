
import { getRedisClient } from '../src/lib/redis-client';
const redis = getRedisClient();

async function fix() {
    const key = 'user:history:astronomer_zero';
    console.log('Checking key:', key);

    const lenBefore = await redis.llen(key);
    console.log('Length before:', lenBefore);

    // Read invalid
    const list = await redis.lrange(key, 0, -1);
    const history = list.map(i => typeof i === 'string' ? JSON.parse(i) : i);

    // Filter down to only ONE BTC call valid (no CA)
    const valid = history.filter((h: any) => h.contractAddress === '' && h.symbol === 'BTC');
    // Deduplicate by tweet URL or ID
    const seen = new Set();
    const unique = [];
    for (const item of valid) {
        if (!seen.has(item.id)) {
            seen.add(item.id);
            unique.push(item);
        }
    }

    console.log(`Found ${unique.length} unique valid items out of ${lenBefore} items.`);

    if (lenBefore > unique.length) {
        console.log('Deleting key...');
        await redis.del(key);

        const lenCheck = await redis.llen(key);
        console.log('Length after del (should be 0):', lenCheck);

        if (unique.length > 0) {
            console.log('Pushing clean history...');
            const p = redis.pipeline();
            for (const item of unique) {
                p.lpush(key, JSON.stringify(item));
            }
            await p.exec();
        }

        const lenFinal = await redis.llen(key);
        console.log('Final length:', lenFinal);
    } // else match, no op

    process.exit(0);
}

fix();
