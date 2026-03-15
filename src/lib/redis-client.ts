
import { Redis } from '@upstash/redis';
import { LocalRedisWrapper } from './redis-wrapper';

export function getRedisClient() {
    const redisUrl = process.env.REDIS_URL;
    const upstashUrl = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
    const upstashToken = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

    // 1. Direct TCP (Recommended for Docker/Local)
    if (redisUrl && redisUrl.startsWith('redis://')) {
        return new LocalRedisWrapper(redisUrl) as unknown as Redis;
    }

    // 2. Upstash Cloud (HTTPS)
    if (upstashUrl.startsWith('https://')) {
        return new Redis({
            url: upstashUrl,
            token: upstashToken,
        });
    }

    // 3. Fallback to Local (HTTP or internal docker name)
    return new LocalRedisWrapper(upstashUrl || 'redis://localhost:6379') as unknown as Redis;
}
