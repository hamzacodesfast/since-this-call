import { getRedisClient } from '../src/lib/redis-client';
import { recalculateUserProfile } from '../src/lib/analysis-store';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
  const redis = getRedisClient();
  const username = 'altcoindaily'; // Must be lowercase for keys
  
  console.log(`Fixing profile for ${username}...`);
  
  // 1. Get true unique calls from ZSET
  const trueCalls = await redis.zrange(`user_index:${username}`, 0, -1);
  console.log(`True unique calls in ZSET: ${trueCalls.length}`);
  
  if (trueCalls.length === 0) {
      console.log('No calls found in ZSET. Cannot rebuild history from scratch securely.');
      return;
  }
  
  // 2. Fetch the massive duplicated history
  const historyData = await redis.lrange(`user:history:${username}`, 0, -1);
  const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
  
  // 3. Deduplicate history by ID, keeping the latest version of each
  const uniqueHistoryMap = new Map<string, any>();
  for (const item of history) {
      if (!uniqueHistoryMap.has(item.id)) {
          uniqueHistoryMap.set(item.id, item);
      }
  }
  
  const cleanHistory = Array.from(uniqueHistoryMap.values());
  console.log(`Cleaned history length: ${cleanHistory.length} (should match ZSET closer)`);
  
  // 4. Overwrite history list
  console.log('Overwriting user history...');
  await redis.del(`user:history:${username}`);
  
  const pipe = redis.pipeline();
  // Reverse to keep chronological order (newest at index 0 requires pushing oldest first, wait no we push newest first so LPUSH puts it at 0)
  // LPUSH puts the LAST pushed item at index 0. 
  // If we want newest at index 0, we should push oldest first.
  // Assuming cleanHistory is sorted newest to oldest already (since it came from lrange 0 -1),
  // we iterate from end to start.
  for (let i = cleanHistory.length - 1; i >= 0; i--) {
      pipe.lpush(`user:history:${username}`, JSON.stringify(cleanHistory[i]));
  }
  await pipe.exec();
  
  // 5. Recalculate Profile Stats
  console.log('Recalculating profile stats...');
  await recalculateUserProfile(username);
  
  const newProfile = await redis.hgetall(`user:profile:${username}`);
  console.log('\n--- FIXED PROFILE ---');
  console.log(newProfile);
}

main().catch(console.error);
