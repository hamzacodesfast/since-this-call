import { NextRequest, NextResponse } from 'next/server';
import { addAnalysis, getRecentAnalyses, StoredAnalysisSchema, updateUserProfile } from '@/lib/analysis-store';
import { rateLimit } from '@/lib/rate-limit';

// Edge runtime works with Upstash Redis REST API


const limiter = rateLimit({
    interval: 60 * 1000, // 60 seconds
    uniqueTokenPerInterval: 500,
});

// GET - Fetch recent analyses
export async function GET() {
    const analyses = await getRecentAnalyses(20);
    return NextResponse.json({ analyses });
}

// POST - Save a new analysis (rate limited + validated)
export async function POST(request: NextRequest) {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    // Rate limiting: 10 requests per minute per IP
    if (!limiter.check(10, ip)) {
        return NextResponse.json(
            { error: 'Rate Limit Exceeded' },
            { status: 429 }
        );
    }

    try {
        const body = await request.json();

        // Zod validation - sanitize all inputs
        const parse = StoredAnalysisSchema.safeParse({
            ...body,
            timestamp: Date.now(), // Server-side timestamp, not client
        });

        if (!parse.success) {
            return NextResponse.json(
                { error: 'Invalid analysis data' },
                { status: 400 }
            );
        }

        const data = parse.data;

        // Block self-analyses (our own tweets)
        if (data.username === 'sincethiscall') {
            return NextResponse.json(
                { error: 'Cannot analyze our own tweets' },
                { status: 400 }
            );
        }

        // Reject invalid symbols (empty, UNK, or too long)
        if (!data.symbol || data.symbol === 'UNK' || data.symbol.length > 20) {
            return NextResponse.json(
                { error: 'Invalid symbol' },
                { status: 400 }
            );
        }

        // Reject invalid performance values
        if (!Number.isFinite(data.performance)) {
            return NextResponse.json(
                { error: 'Invalid performance value' },
                { status: 400 }
            );
        }

        await addAnalysis(data);

        // Update User Profile (fire and forget)
        // Note: Edge functions might kill this early if not awaited, but usually okay for small tasks.
        // Ideally we await it to ensure data consistency.
        await updateUserProfile(data);

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json(
            { error: 'Failed to save analysis' },
            { status: 400 }
        );
    }
}
