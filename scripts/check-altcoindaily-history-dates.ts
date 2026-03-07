import { getRedisClient } from '../src/lib/redis-client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
  const redis = getRedisClient();
  const username = 'altcoindaily';
  
  const historyData = await redis.lrange(`user:history:${username}`, 0, -1);
  const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
  
  console.log(`Total history length: ${history.length}`);
  
  const counts = new Map<string, number>();
  let firstSeen = new Map<string, Date>();
  
  for (const item of history) {
      const id = item.id;
      counts.set(id, (counts.get(id) || 0) + 1);
  }
  
  console.log('\nTop duplicated IDs:');
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [id, count] of sorted) {
      console.log(`ID: ${id} | Count: ${count}`);
  }
  
}
main().catch(console.error);
