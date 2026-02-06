
import { LocalRedisWrapper } from '../src/lib/redis-wrapper';

async function test() {
    const redis = new LocalRedisWrapper('redis://localhost:6379');

    console.log('--- Testing direct sadd ---');
    await redis.sadd('test_set_direct', 'a', 'b', 'c');
    const directMembers = await redis.smembers('test_set_direct');
    console.log('Direct Members:', directMembers);

    console.log('--- Testing pipeline sadd ---');
    const p = redis.pipeline();
    const items = ['x', 'y', 'z'];
    // @ts-ignore
    p.sadd('test_set_pipeline', ...items);
    await p.exec();

    const pipeMembers = await redis.smembers('test_set_pipeline');
    console.log('Pipeline Members:', pipeMembers);

    process.exit(0);
}

test();
