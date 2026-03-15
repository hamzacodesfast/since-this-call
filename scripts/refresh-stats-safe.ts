
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
const envFile = process.argv.includes('--prod') ? '.env.production' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile), override: true });
dotenv.config({ override: true });

const url = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const token = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

if (!url) {
    console.error('❌ No Redis URL found in env.');
    process.exit(1);
}

const redis = new Redis({ url, token });

async function refreshTicker(tickerKey: string) {
    console.log(`\n🔄 Refreshing stats for ${tickerKey}...`);
    
    const indexKey = `ticker_index:${tickerKey}`;
    const analysisRefs = await redis.zrange(indexKey, 0, -1) as string[];
    
    console.log(`   Found ${analysisRefs.length} analysis references.`);
    
    if (analysisRefs.length === 0) {
        await redis.del(`ticker:profile:${tickerKey}`);
        console.log(`   ✅ Ticker profile deleted (no analyses).`);
        return;
    }

    let wins = 0;
    let losses = 0;
    let neutral = 0;
    let bullish = 0;
    let bearish = 0;
    let lastAnalyzed = 0;

    const userMap = new Map<string, string[]>();
    for (const ref of analysisRefs) {
        const [username, id] = (ref as string).split(':');
        if (!userMap.has(username)) userMap.set(username, []);
        userMap.get(username)!.push(id);
    }

    const usernames = Array.from(userMap.keys());
    console.log(`   Fetching history for ${usernames.length} unique users...`);
    
    const pipeline = redis.pipeline();
    for (const u of usernames) {
        pipeline.lrange(`user:history:${u}`, 0, -1);
    }
    
    const histories = await pipeline.exec();

    for (let i = 0; i < histories.length; i++) {
        const targetIds = new Set(userMap.get(usernames[i]));
        const history = histories[i] as any[];

        if (Array.isArray(history)) {
            for (const item of history) {
                const a = typeof item === 'string' ? JSON.parse(item) : item;
                if (targetIds.has(a.id)) {
                    if (Math.abs(a.performance) < 0.01) neutral++;
                    else if (a.isWin) wins++;
                    else losses++;

                    if (a.sentiment === 'BULLISH') bullish++;
                    else if (a.sentiment === 'BEARISH') bearish++;

                    if (a.timestamp > lastAnalyzed) lastAnalyzed = a.timestamp;
                }
            }
        }
    }

    const stats = {
        symbol: tickerKey.split(':')[1],
        type: tickerKey.split(':')[0],
        totalAnalyses: analysisRefs.length,
        wins,
        losses,
        neutral,
        bullish,
        bearish,
        winRate: analysisRefs.length > 0 ? (wins / analysisRefs.length) * 100 : 0,
        lastAnalyzed
    };

    await redis.hset(`ticker:profile:${tickerKey}`, stats);
    console.log(`   ✅ Profile updated: ${analysisRefs.length} calls, ${wins}W / ${losses}L / ${neutral}N`);
}

async function run() {
    await refreshTicker('STOCK:CL');
    await refreshTicker('STOCK:CL=F');
    process.exit(0);
}

run();
