
import { NextResponse } from 'next/server';
import { getAllUserProfiles } from '@/lib/analysis-store';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const profiles = await getAllUserProfiles();
        return NextResponse.json({ profiles });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
    }
}
