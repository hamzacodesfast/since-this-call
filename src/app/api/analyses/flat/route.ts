import { getRedisClient } from '@/lib/redis-client';
import { NextResponse } from 'next/server';

const redis = getRedisClient();



export async function GET() {
    try {
        const users = await redis.smembers('all_users');
        let flatCalls = [];

        for (const user of users) {
            const history = await redis.lrange(`user:history:${user.toLowerCase()}`, 0, -1);
            const neutral = history.filter((item: any) => {
                const p = typeof item === 'string' ? JSON.parse(item) : item;
                // Catch anything with exactly 0 (fixed nulls) or very low movement
                return p.performance === 0 || (p.performance !== null && Math.abs(p.performance) < 0.05);
            }).map((n: any) => typeof n === 'string' ? JSON.parse(n) : n);

            flatCalls.push(...neutral);
        }

        // Sort by timestamp (most recent first)
        flatCalls.sort((a, b) => b.timestamp - a.timestamp);

        return NextResponse.json({ calls: flatCalls });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch flat calls' }, { status: 500 });
    }
}
