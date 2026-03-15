
import { Redis } from '@upstash/redis';
import { LocalRedisWrapper } from './redis-wrapper';

export function getRedisClient() {
    const url = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
    const token = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

    // Check if we are running locally (Standard Redis URL, localhost, or internal docker name 'redis')
    if (!url || url.includes('localhost') || url.includes('127.0.0.1') || url.includes('redis') || url.startsWith('redis://')) {
        return new LocalRedisWrapper(url || 'http://localhost:8080') as unknown as Redis;
    }

    // Production (Upstash HTTP)
    return new Redis({
        url,
        token,
    });
}
