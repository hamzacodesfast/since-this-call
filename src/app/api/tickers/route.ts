
import { NextResponse } from 'next/server';
import { getAllTickerProfiles } from '@/lib/analysis-store';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const profiles = await getAllTickerProfiles();
        return NextResponse.json({ profiles });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch ticker profiles' }, { status: 500 });
    }
}
