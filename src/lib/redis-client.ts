
import { Redis } from '@upstash/redis';
import { LocalRedisWrapper } from './redis-wrapper';

export function getRedisClient() {
    const redisUrl = process.env.REDIS_URL;
    const upstashUrl = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
    const upstashToken = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

    // 1. Direct TCP (Preferred for Docker/VPS)
    if (redisUrl && (redisUrl.startsWith('redis://') || redisUrl.includes('@redis:'))) {
        return new LocalRedisWrapper(redisUrl) as unknown as Redis;
    }

    // 2. Upstash Cloud (HTTPS) - ONLY if it's actually an external Upstash URL
    if (upstashUrl.startsWith('https://')) {
        return new Redis({
            url: upstashUrl,
            token: upstashToken,
        });
    }

    // 3. Fallback (Docker internal or Local)
    const fallbackUrl = redisUrl || upstashUrl || 'redis://localhost:6379';
    return new LocalRedisWrapper(fallbackUrl) as unknown as Redis;
}
