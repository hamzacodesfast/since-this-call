import { NextRequest, NextResponse } from 'next/server';
import { getTweet } from 'react-tweet/api';
import { extractCallFromText } from '@/lib/ai-extractor';
import { getPrice, calculatePerformance } from '@/lib/market-data';
import { rateLimit } from '@/lib/rate-limit';

// Rate Limiter: 5 requests per minute per IP
const limiter = rateLimit({
    interval: 60 * 1000, // 60 seconds
    uniqueTokenPerInterval: 500, // Max 500 users per second unique IP tracking
});

export async function GET(request: NextRequest) {
    // Basic IP-based rate limiting
    // In Vercel/Next.js, 'x-forwarded-for' is usually the best bet.
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    // Check Limit (5 req / min) -- Strict to prevent bill parabolics
    const isAllowed = limiter.check(5, ip);

    if (!isAllowed) {
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
        // 1. Extract Tweet ID
        const tweetId = tweetUrl.split('/').pop()?.split('?')[0];
        if (!tweetId) {
            return NextResponse.json({ error: 'Invalid tweet URL' }, { status: 400 });
        }

        // 2. Fetch Tweet Content
        const tweet = await getTweet(tweetId);
        if (!tweet) {
            return NextResponse.json({ error: 'Tweet not found' }, { status: 404 });
        }

        // 3. AI Extraction
        // We use tweet.created_at (which is usually ISO string)
        // Note: react-tweet returns created_at as a string
        const callData = await extractCallFromText(tweet.text, tweet.created_at);

        if (!callData) {
            return NextResponse.json({ error: 'Could not identify financial call' }, { status: 422 });
        }

        // 4. Market Data Fetch
        // Historical Price
        const callDate = new Date(callData.date);
        const callPrice = await getPrice(callData.symbol, callData.type, callDate);

        // Current Price
        const currentPrice = await getPrice(callData.symbol, callData.type);

        if (callPrice === null || currentPrice === null) {
            const isStock = callData.type === 'STOCK';
            const msg = isStock
                ? "Stock data is currently unavailable (API Blocked). Please try Crypto!"
                : "Market data not found for this asset.";

            return Response.json(
                {
                    error: msg,
                    details: { callData, callPrice, currentPrice }
                },
                { status: 422 }
            );
        }

        // 5. Calculate Performance
        const performance = calculatePerformance(callPrice, currentPrice);

        return NextResponse.json({
            analysis: callData,
            market: {
                callPrice,
                currentPrice,
                performance,
                currency: 'USD'
            },
            tweet: {
                id: tweet.id_str,
                text: tweet.text,
                author: tweet.user.name,
                username: tweet.user.screen_name,
                date: tweet.created_at
            }
        });

    } catch (error) {
        console.error('Analysis error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
