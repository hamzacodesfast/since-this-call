import { getRedisClient } from '../src/lib/redis-client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
  const redis = getRedisClient();
  const profile = await redis.hgetall('user:profile:altcoindaily');
  console.log('Profile:', profile);
  
  const history = await redis.lrange('user:history:altcoindaily', 0, 10);
  console.log('\nRecent 10 History Items:');
  history.forEach((h: any, i: number) => {
      const item = typeof h === 'string' ? JSON.parse(h) : h;
      console.log(`[${i}] ${item.sentiment} ${item.symbol} | Win: ${item.isWin} | Perf: ${item.performance} | ID: ${item.id}`);
  });
}
main().catch(console.error);
