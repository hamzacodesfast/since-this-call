import { getRedisClient } from '../src/lib/redis-client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
  const redis = getRedisClient();
  const allUsers = await redis.smembers('all_users');
  
  console.log(`Checking ${allUsers.length} users for duplicate history items...`);
  
  let corruptedUsers = 0;
  
  for (const user of allUsers) {
      const historyData = await redis.lrange(`user:history:${user.toLowerCase()}`, 0, -1);
      if (historyData.length === 0) continue;
      
      const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
      const uniqueIds = new Set();
      let duplicates = 0;
      
      for (const item of history) {
          if (uniqueIds.has(item.id)) {
              duplicates++;
          }
          uniqueIds.add(item.id);
      }
      
      if (duplicates > 0) {
          console.log(`User @${user} has ${duplicates} duplicates! (Total: ${history.length}, Unique: ${uniqueIds.size})`);
          corruptedUsers++;
      }
  }
  
  console.log(`\nFound ${corruptedUsers} users with corrupted/duplicate data.`);
  process.exit(0);
}
main().catch(console.error);
