import { getRedisClient } from '../src/lib/redis-client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
  const redis = getRedisClient();
  const username = 'nextbigtrade';
  const historyData = await redis.lrange(`user:history:${username}`, 0, -1);
  console.log(`History length: ${historyData.length}`);
}
main().catch(console.error);
