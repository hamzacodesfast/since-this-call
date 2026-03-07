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

        // Check cache first
        const cacheKey = 'cache:trader:scan';
        if (!forceRefresh) {
            const cached = await redis.get(cacheKey);
            if (cached) {
                const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
                return NextResponse.json(data, {
                    headers: {
                        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
                        'X-Cache': 'HIT',
                    },
                });
            }
        }

        // Run full scan
        const result = await runFullScan();

        // Cache the result
        await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });

        return NextResponse.json(result, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
                'X-Cache': 'MISS',
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
