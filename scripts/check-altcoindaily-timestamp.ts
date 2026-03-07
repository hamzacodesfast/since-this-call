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
  
  console.log(`History length: ${history.length}`);
  if(history.length > 0) {
      console.log('Sample item timestamp: ', new Date(history[0].timestamp).toISOString());
  }
}
main().catch(console.error);
