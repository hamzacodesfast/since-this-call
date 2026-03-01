import { NextResponse } from 'next/server';
import { getAllTickerProfiles } from '@/lib/analysis-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '30');
        const search = searchParams.get('search') || undefined;

        const { profiles, hasMore } = await getAllTickerProfiles({ page, limit, search });
        return NextResponse.json({ profiles, hasMore });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch ticker profiles' }, { status: 500 });
    }
}
