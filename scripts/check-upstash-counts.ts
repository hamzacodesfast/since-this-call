import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production.local') });

async function checkSync() {
    const redis = new Redis({
        url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL!,
        token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
    });

    console.log('--- UPSTASH (SOURCE) ---');
    const allUsersCount = await redis.scard('all_users');
    const globalAnalyses = await redis.zcard('global:analyses:timestamp');
    const trackedTickersCount = await redis.scard('tracked_tickers');
    const recentAnalyses = await redis.llen('recent_analyses');
    
    // Count keys by pattern
    const tickerProfiles = (await redis.keys('ticker:profile:*')).length;
    const userProfiles = (await redis.keys('user:profile:*')).length;
    
    console.log(`All Users (Set): ${allUsersCount}`);
    console.log(`User Profile Keys: ${userProfiles}`);
    console.log(`Global Analyses Index: ${globalAnalyses}`);
    console.log(`Tracked Tickers (Set): ${trackedTickersCount}`);
    console.log(`Ticker Profile Keys: ${tickerProfiles}`);
    console.log(`Recent Analyses: ${recentAnalyses}`);
}

checkSync();
