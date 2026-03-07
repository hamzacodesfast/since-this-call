import { getRedisClient } from '../src/lib/redis-client';
import { recalculateUserProfile } from '../src/lib/analysis-store';
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
  const username = 'altcoindaily';
  
  // 1. Fetch current history
  console.log('Fetching history...');
  const historyData = await redis.lrange(`user:history:${username}`, 0, -1);
  const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
  
  // 2. Deduplicate
  const uniqueHistoryMap = new Map<string, any>();
  for (const item of history) {
      if (!uniqueHistoryMap.has(item.id)) {
          uniqueHistoryMap.set(item.id, item);
      }
  }
  const cleanHistory = Array.from(uniqueHistoryMap.values());
  console.log(`Cleaned history length: ${cleanHistory.length}`);

  // 3. Clear and Set explicitly on both clients (waiting for both)
  console.log('Writing to DBs...');
  
  async function writeTo(r: Redis, name: string) {
      console.log(`Writing to ${name}...`);
      await r.del(`user:history:${username}`);
      if (cleanHistory.length > 0) {
          const pipe = r.pipeline();
          for (let i = cleanHistory.length - 1; i >= 0; i--) {
              pipe.lpush(`user:history:${username}`, JSON.stringify(cleanHistory[i]));
          }
          await pipe.exec();
      }
      console.log(`${name} complete.`);
  }

  await writeTo(redis as Redis, "Primary");
  if (redisProd) await writeTo(redisProd, "Production Fallback");
  
  // 4. Verify
  const checkData = await redis.lrange(`user:history:${username}`, 0, -1);
  console.log(`Verified length in Primary: ${checkData.length}`);
  
  // 5. Recalculate Profile Stats
  console.log('Recalculating profile stats...');
  await recalculateUserProfile(username);
  
  const newProfile = await redis.hgetall(`user:profile:${username}`);
  console.log('\n--- FIXED PROFILE ---');
  console.log(newProfile);
  
  process.exit(0);
}

main().catch(console.error);
