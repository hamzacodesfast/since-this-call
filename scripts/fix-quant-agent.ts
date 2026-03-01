import { getRedisClient } from '../src/lib/redis-client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.production.local' });

const redis = getRedisClient();

async function run() {
    const historyKey = 'user:history:stcquantagent';
    const profileKey = 'user:profile:stcquantagent';
    
    const historyData = await redis.lrange(historyKey, 0, -1);
    const history = historyData.map((d: any) => typeof d === 'string' ? JSON.parse(d) : d);
    
    const uniqueIds = new Set<string>();
    const newHistory: any[] = [];
    
    let wins = 0;
    let losses = 0;
    let neutral = 0;
    
    for (const h of history) {
        if (!uniqueIds.has(h.id)) {
            uniqueIds.add(h.id);
            newHistory.push(h);
            
            if (h.isWin === true) wins++;
            else if (h.isWin === false && h.performance < -0.01) losses++;
            else neutral++;
        }
    }
    
    console.log(`Original count: ${history.length}, New count: ${newHistory.length}`);
    
    // Save history
    await redis.del(historyKey);
    const pipeline = redis.pipeline();
    for (let j = newHistory.length - 1; j >= 0; j--) {
        pipeline.lpush(historyKey, JSON.stringify(newHistory[j]));
    }
    
    // Update profile
    const winRate = newHistory.length > 0 ? (wins / newHistory.length) * 100 : 0;
    pipeline.hset(profileKey, {
        wins,
        losses,
        neutral,
        totalAnalyses: newHistory.length,
        winRate
    });
    
    await pipeline.exec();
    console.log("Fixed STCQUANTAGENT profile and history in Redis");
    process.exit(0);
}
run();
