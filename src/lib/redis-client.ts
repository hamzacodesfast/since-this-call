
import { Redis } from '@upstash/redis';
import { LocalRedisWrapper } from './redis-wrapper';

export function getRedisClient() {
    let redisUrl = process.env.REDIS_URL || process.env.NEW_REDIS_URL;
    let upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.KV_REST_API_URL || '';
    let upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || '';

    // 1. Direct TCP (VPS Production / Docker)
    // If we have a redis:// URL, use the local IORedis wrapper
    if (redisUrl && (redisUrl.startsWith('redis://') || redisUrl.includes('@redis:'))) {
        // Inject password if available but not in URL
        if (process.env.REDIS_PASSWORD && !redisUrl.includes('@') && !redisUrl.includes(':password@')) {
            const parts = redisUrl.split('://');
            if (parts.length === 2) {
                redisUrl = `${parts[0]}://default:${process.env.REDIS_PASSWORD}@${parts[1]}`;
            }
        }
        return new LocalRedisWrapper(redisUrl) as unknown as Redis;
    }

    // 2. HTTPS Proxy (Cloud/Vercel legacy - but we point it to VPS Redis now)
    // If it's a URL but doesn't start with redis://, it's likely a REST proxy
    if (upstashUrl && upstashUrl.startsWith('https://') && !upstashUrl.includes('upstash.io')) {
        return new Redis({
            url: upstashUrl,
            token: upstashToken,
        });
    }

    // 3. Last Resort Fallback
    let fallbackUrl = redisUrl || 'redis://localhost:6379';
    if (process.env.REDIS_PASSWORD && !fallbackUrl.includes('@')) {
        fallbackUrl = `redis://default:${process.env.REDIS_PASSWORD}@localhost:6379`;
    }
    console.log(`📡 Redis Fallback: ${fallbackUrl.split('@').pop()}`);
    return new LocalRedisWrapper(fallbackUrl) as unknown as Redis;
}
