
import Redis from 'ioredis';

const redis = new Redis('redis://localhost:6379');

async function inspect() {
    const user = 'stronghedge'; // or 'maxbecausebtc'
    const key = `user:profile:${user}`;

    console.log(`Inspecting key: ${key}`);
    const type = await redis.type(key);
    console.log(`Type: ${type}`);

    if (type === 'hash') {
        const data = await redis.hgetall(key);
        console.log('Raw HGETALL result:', data);

        console.log('\nKeys and Types:');
        for (const [k, v] of Object.entries(data)) {
            console.log(`Key: "${k}" (Hex: ${Buffer.from(k).toString('hex')}) -> Value: "${v}"`);
        }
    } else {
        console.log('Not a hash!');
    }

    process.exit(0);
}

inspect().catch(console.error);
