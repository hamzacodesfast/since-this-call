import { getRedisClient } from '../src/lib/redis-client';
import { dualWrite } from '../src/lib/analysis-store';
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
  
  // 1. Fetch current history from BOTH to be absolutely sure
  const histPrimary = await redis.lrange(`user:history:${username}`, 0, -1);
  const histProd = redisProd ? await redisProd.lrange(`user:history:${username}`, 0, -1) : [];
  console.log(`History length - Primary: ${histPrimary.length}, Prod: ${histProd.length}`);
  
  // We'll use histPrimary since we know we cleaned it
  const history = histPrimary.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);

  let wins = 0;
  let losses = 0;
  let neutral = 0;
  const total = history.length;

  for (const item of history) {
      if (Math.abs(item.performance) < 0.01) {
          neutral++;
      } else if (item.isWin) {
          wins++;
      } else {
          losses++;
      }
  }

  const winRate = total > 0 ? (wins / total) * 100 : 0;
  
  const existingProfile = await redis.hgetall(`user:profile:${username}`) as any;
  const avatar = existingProfile?.avatar || history[0]?.avatar || '';

  const newStats = {
      username: 'AltcoinDaily',
      avatar: avatar,
      totalAnalyses: total,
      wins,
      losses,
      neutral,
      winRate,
      lastAnalyzed: Date.now(),
      isVerified: existingProfile?.isVerified === 'true' || existingProfile?.isVerified === true,
  };
  
  console.log('Writing new stats to hashes natively...');
  
  async function writeHash(r: Redis, name: string) {
      await r.hset(`user:profile:${username}`, newStats as any);
      console.log(`Wrote hash to ${name}`);
  }

  await writeHash(redis as Redis, "Primary");
  if (redisProd) await writeHash(redisProd, "Production");
  
  // Also fix the new cache added manually
  console.log('Clearing profiles cache...');
  async function clearCache(r: Redis) {
      const keys = await r.keys('cache:profiles:*');
      if (keys.length > 0) {
          await r.del(...keys);
      }
  }
  await clearCache(redis as Redis);
  if (redisProd) await clearCache(redisProd);

  const finalCheck = await redis.hgetall(`user:profile:${username}`);
  console.log('\n--- FINAL HASH ---');
  console.log(finalCheck);
  
  process.exit(0);
}

main().catch(console.error);
