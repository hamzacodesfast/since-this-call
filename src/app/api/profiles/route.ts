import { NextResponse } from 'next/server';
import { getAllUserProfiles } from '@/lib/analysis-store';
import { getRedisClient } from '@/lib/redis-client';

export const dynamic = 'force-dynamic';

const CACHE_TTL = 10 * 60; // 10 minutes

export async function GET(request: Request) {
    try {
        const redis = getRedisClient();
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '30');
        const search = searchParams.get('search') || undefined;

        // Check cache first
        const cacheKey = `cache:profiles:p${page}:l${limit}:s${search || ''}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
            return NextResponse.json(data, {
                headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60' },
            });
        }

        const { profiles, hasMore } = await getAllUserProfiles({ page, limit, search });
        const result = { profiles, hasMore };

        // Cache the result
        await redis.set(cacheKey, JSON.stringify(result), { ex: CACHE_TTL });

        return NextResponse.json(result, {
            headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60' },
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
    }
}
