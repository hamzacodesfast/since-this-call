import { NextRequest, NextResponse } from 'next/server';
import { refreshAllAnalyses } from '@/lib/price-refresher';



// Vercel Cron sends a specific header to verify authenticity
// Or use a secret for manual triggers
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
    // Verify the request is from Vercel Cron or has valid secret
    const authHeader = request.headers.get('authorization');
    const cronHeader = request.headers.get('x-vercel-cron');

    // Allow if:
    // 1. It's a Vercel Cron request (has x-vercel-cron header)
    // 2. Or has valid Bearer token matching CRON_SECRET
    // 3. Or CRON_SECRET is not set (development mode)
    const isVercelCron = cronHeader !== null;
    const hasValidSecret = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
    const isDev = !CRON_SECRET;

    if (!isVercelCron && !hasValidSecret && !isDev) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    console.log('[Cron] Starting price refresh...');
    const startTime = Date.now();

    try {
        const result = await refreshAllAnalyses();
        const duration = Date.now() - startTime;

        console.log(`[Cron] Completed in ${duration}ms`);

        return NextResponse.json({
            success: true,
            ...result,
            durationMs: duration,
        });

    } catch (error: any) {
        console.error('[Cron] Refresh failed:', error);

        return NextResponse.json(
            { error: error.message, success: false },
            { status: 500 }
        );
    }
}
