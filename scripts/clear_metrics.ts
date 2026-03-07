import { getRedisClient } from '../src/lib/redis-client';
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const redisProd = (process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL)
    ? new Redis({
        url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL,
        token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
    })
    : null;

async function main() {
  const redis = getRedisClient();
  
  await redis.del('platform_metrics');
  if (redisProd) await redisProd.del('platform_metrics');
  
  console.log('Cleared metrics cache');
  process.exit(0);
}

main().catch(console.error);
