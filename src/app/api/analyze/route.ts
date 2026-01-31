import { NextRequest, NextResponse } from 'next/server';
import { analyzeTweet } from '@/lib/analyzer';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const limiter = rateLimit({
    interval: 60 * 1000,
    uniqueTokenPerInterval: 500,
});

const analyzeSchema = z.object({
    url: z.string().url(),
    type: z.enum(['CRYPTO', 'STOCK']).optional(),
});

export async function GET(request: NextRequest) {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    if (!limiter.check(10, ip)) {
        return NextResponse.json(
            { error: 'Rate Limit Exceeded. Please wait a minute.' },
            { status: 429 }
        );
    }

    const { searchParams } = new URL(request.url);
    const rawParams = {
        url: searchParams.get('url'),
        type: searchParams.get('type') || undefined,
    };

    const validation = analyzeSchema.safeParse(rawParams);

    if (!validation.success) {
        return NextResponse.json({ error: 'Invalid input parameters', details: validation.error.format() }, { status: 400 });
    }

    const { url: tweetUrl, type: typeOverride } = validation.data;

    try {
        const tweetId = tweetUrl.split('/').pop()?.split('?')[0];
        if (!tweetId) {
            return NextResponse.json({ error: 'Invalid tweet URL' }, { status: 400 });
        }

        const result = await analyzeTweet(tweetId, typeOverride || undefined);
        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Analysis error:', error);
        const status = error.message.includes('not found') ? 404 : 422;
        return NextResponse.json({ error: error.message }, { status });
    }
}
