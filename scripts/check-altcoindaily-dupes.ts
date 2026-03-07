import { getRedisClient } from '../src/lib/redis-client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
  const redis = getRedisClient();
  
  const history = await redis.lrange('user:history:altcoindaily', 0, -1);
  console.log(`Total history items in list: ${history.length}`);
  
  const idCounts = new Map<string, number>();
  let duplicates = 0;
  
  history.forEach((h: any) => {
      const item = typeof h === 'string' ? JSON.parse(h) : h;
      const count = idCounts.get(item.id) || 0;
      if (count > 0) duplicates++;
      idCounts.set(item.id, count + 1);
  });
  
  console.log(`Unique IDs parsed: ${idCounts.size}`);
  console.log(`Duplicate entries found: ${duplicates}`);
  
  const indexCount = await redis.zcard('user_index:altcoindaily');
  console.log(`Items in user_index:altcoindaily (ZSET): ${indexCount}`);
}
main().catch(console.error);
