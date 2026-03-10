import { NextResponse } from 'next/server';
import { runFullScan } from '@/lib/trader-agent';
import { getRedisClient } from '@/lib/redis-client';

export const dynamic = 'force-dynamic';

const CACHE_TTL = 5 * 60; // 5 minutes

export async function GET(request: Request) {
    try {
        const redis = getRedisClient();
        const { searchParams } = new URL(request.url);
        const forceRefresh = searchParams.get('refresh') === 'true';

        // Check cache first for the heavy scan data
        const cacheKey = 'cache:trader:scan';
        let result: any;
        let cacheHit = false;

        if (!forceRefresh) {
            const cached = await redis.get(cacheKey);
            if (cached) {
                result = typeof cached === 'string' ? JSON.parse(cached) : cached;
                cacheHit = true;
            }
        }

        if (!result) {
            result = await runFullScan();
            await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });
        }

        return NextResponse.json(result, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
                'X-Cache': cacheHit ? 'HIT' : 'MISS',
            },
        });
    } catch (error) {
        console.error('[TraderAPI] Scan failed:', error);
        return NextResponse.json(
            { error: 'Failed to run trader scan' },
            { status: 500 }
        );
    }
}
