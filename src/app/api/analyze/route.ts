import { NextRequest, NextResponse } from 'next/server';
import { analyzeTweet } from '@/lib/analyzer';
import { updateUserProfile, addAnalysis } from '@/lib/analysis-store';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const limiter = rateLimit({
    interval: 60 * 1000,
    uniqueTokenPerInterval: 500,
});

const analyzeSchema = z.object({
    url: z.string().url(),
    type: z.enum(['CRYPTO', 'STOCK']).optional(),
    save: z.enum(['true', 'false']).optional(), // Auto-save to Redis
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
        save: searchParams.get('save') || 'true', // Default: auto-save
    };

    const validation = analyzeSchema.safeParse(rawParams);

    if (!validation.success) {
        return NextResponse.json({ error: 'Invalid input parameters', details: validation.error.format() }, { status: 400 });
    }

    const { url: tweetUrl, type: typeOverride, save } = validation.data;
    const shouldSave = save !== 'false';

    try {
        const tweetId = tweetUrl.split('/').pop()?.split('?')[0];
        if (!tweetId) {
            return NextResponse.json({ error: 'Invalid tweet URL' }, { status: 400 });
        }

        const result = await analyzeTweet(tweetId, typeOverride || undefined);

        // Auto-save successful analyses to Redis
        if (shouldSave && result.analysis.action) {
            const storedItem = {
                id: result.tweet.id,
                username: result.tweet.username,
                author: result.tweet.author,
                avatar: result.tweet.avatar,
                symbol: result.analysis.symbol,
                sentiment: result.analysis.sentiment,
                performance: result.market.performance,
                isWin: result.market.performance > 0,
                timestamp: new Date(result.tweet.date).getTime(),
                entryPrice: result.market.callPrice,
                currentPrice: result.market.currentPrice,
                type: result.analysis.type,
                ticker: result.analysis.symbol,
                action: result.analysis.action,
                confidence_score: result.analysis.confidence_score,
                timeframe: result.analysis.timeframe,
                is_sarcasm: result.analysis.is_sarcasm,
                reasoning: result.analysis.reasoning,
                warning_flags: result.analysis.warning_flags,
                tweetUrl: `https://x.com/${result.tweet.username}/status/${result.tweet.id}`,
                text: result.tweet.text
            };

            await updateUserProfile(storedItem);
            await addAnalysis(storedItem);
            console.log(`[API] Auto-saved: ${result.analysis.action} ${result.analysis.symbol} by @${result.tweet.username}`);
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Analysis error:', error);
        const status = error.message.includes('not found') ? 404 : 422;
        return NextResponse.json({ error: error.message }, { status });
    }
}
