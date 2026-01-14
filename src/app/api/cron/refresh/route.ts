
import { NextResponse } from 'next/server';
import { refreshAllProfiles } from '@/lib/price-updater';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(request: Request) {
    // Basic auth check (optional, but good for cron)
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('key');

    // Simple protection if needed, or rely on Vercel Cron protection
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Trigger background refresh
        // We await here for simplicity but could be fire-and-forget
        await refreshAllProfiles();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Cron failed:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
