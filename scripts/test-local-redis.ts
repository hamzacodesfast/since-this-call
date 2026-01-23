
import dotenv from 'dotenv';
import path from 'path';
import { Redis } from '@upstash/redis';

// Note: This script assumes you have updated .env.local to point to localhost:8080
// OR you can pass env vars directly for verification
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verifyLocal() {
    console.log('🔍 Verifying Local Redis Connection...');
    console.log(`URL: ${process.env.UPSTASH_REDIS_REST_KV_REST_API_URL}`);

    if (!process.env.UPSTASH_REDIS_REST_KV_REST_API_URL?.includes('localhost')) {
        console.error('❌ ERROR: You are still pointing to PRODUCTION Upstash!');
        console.log('Please update .env.local to:');
        console.log('UPSTASH_REDIS_REST_KV_REST_API_URL="http://localhost:8080"');
        console.log('UPSTASH_REDIS_REST_KV_REST_API_TOKEN="example_token"');
        return;
    }

    try {
        const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
            token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
        });

        await redis.set('test_local', 'working_' + Date.now());
        const val = await redis.get('test_local');
        console.log(`✅ SUCCESS: Local Redis is responding. Value: ${val}`);

        // Clean up
        await redis.del('test_local');
    } catch (e: any) {
        console.error('❌ Connection Failed:', e.message);
        console.log('\nMake sure you have run:');
        console.log('docker-compose up -d');
    }
}

verifyLocal().catch(console.error);
