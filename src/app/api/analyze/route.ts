
import { NextRequest, NextResponse } from 'next/server';
import { analyzeTweet } from '@/lib/analyzer';

export const runtime = 'edge';

// Simple in-memory rate limit for Edge (per-check)
const RATE_LIMIT_MAP = new Map<string, number>();

function checkRateLimit(ip: string) {
    const count = RATE_LIMIT_MAP.get(ip) || 0;
    if (count > 10) return false; // 10 req/min

    RATE_LIMIT_MAP.set(ip, count + 1);

    // Clear casually
    if (Math.random() > 0.9) RATE_LIMIT_MAP.clear();

    return true;
}

export async function GET(request: NextRequest) {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    if (!checkRateLimit(ip)) {
        return NextResponse.json(
            { error: 'Rate Limit Exceeded. Please wait a minute.' },
            { status: 429 }
        );
    }

    const { searchParams } = new URL(request.url);
    const tweetUrl = searchParams.get('url');

    if (!tweetUrl) {
        return NextResponse.json({ error: 'Missing tweet URL' }, { status: 400 });
    }

    try {
        const tweetId = tweetUrl.split('/').pop()?.split('?')[0];
        if (!tweetId) {
            return NextResponse.json({ error: 'Invalid tweet URL' }, { status: 400 });
        }

        const result = await analyzeTweet(tweetId);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Analysis error:', error);

        // Handle specific known errors with proper codes if needed
        const status = error.message.includes('not found') ? 404 : 422;

        return NextResponse.json({ error: error.message }, { status });
    }
}
