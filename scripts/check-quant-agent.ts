import { getRedisClient } from '../src/lib/redis-client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.production.local' });

const redis = getRedisClient();

async function run() {
    const historyData = await redis.lrange('user:history:stcquantagent', 0, -1);
    const history = historyData.map((d: any) => typeof d === 'string' ? JSON.parse(d) : d);
    
    console.log("Total calls:", history.length);
    let totalWins = 0;
    let totalLosses = 0;
    
    for (const item of history) {
        if (!item.tweetUrl) {
            console.log("MISSING URL FOR:", item.symbol);
        }
        if (item.isWin === true) totalWins++;
        if (item.isWin === false && item.performance < -0.01) totalLosses++;
        
        console.log(`- ${item.symbol} | ${item.sentiment} | Perf: ${item.performance.toFixed(2)}% | Win: ${item.isWin}`);
    }
    
    console.log(`W: ${totalWins}, L: ${totalLosses}`);
    process.exit(0);
}
run();
