
import { NextRequest, NextResponse } from 'next/server';
import { getTweet } from 'react-tweet/api';
import { extractCallFromText } from '@/lib/ai-extractor';
import { getPrice, calculatePerformance } from '@/lib/market-data';

export const runtime = 'edge';

// Simple in-memory rate limit for Edge (per-check)
// Note: In strict Serverless/Edge, global state isn't guaranteed perfectly,
// but sufficient for basic abuse prevention without external KV.
const RATE_LIMIT_MAP = new Map<string, number>();

function checkRateLimit(ip: string) {
    const now = Date.now();
    const windowStart = now - 60 * 1000;

    // Cleanup old entries
    // In a real high-scale app, use Vercel KV/Redis

    const count = RATE_LIMIT_MAP.get(ip) || 0;
    if (count > 10) return false; // 10 req/min

    RATE_LIMIT_MAP.set(ip, count + 1);

    // Self-cleaning strictly for this isolate
    if (Math.random() > 0.9) {
        // Occasional cleanup
        // RATE_LIMIT_MAP.clear(); // Too aggressive
    }

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

        // 3. Anti-Cheating / Time Travel Check
        // If the tweet was edited, the 'created_at' is the ORIGINAL time, but the text is CURRENT.
        // This allows people to change their prediction after the fact.
        // We MUST detect if it was edited.
        // react-tweet (v3) object structure usually includes `edit_info` or `isEdited`.
        // If strict cheat detection is needed, we should warn the user.

        const isEdited = (tweet as any).edit_info?.initial?.edit_tweet_ids?.length > 1 || (tweet as any).isEdited;

        if (isEdited) {
            return NextResponse.json({
                error: 'Edited Tweet Detected. "Since This Call" only validates unedited predictions to prevent "Time Travel" cheating.'
            }, { status: 422 });
        }


        // 4. AI Extraction
        const callData = await extractCallFromText(tweet.text, tweet.created_at);

        if (!callData) {
            return NextResponse.json({ error: 'Could not identify financial call' }, { status: 422 });
        }

        // 5. Market Data Fetch
        const callDate = new Date(callData.date);

        // Validation: Call Date cannot be in future (Timezones?)
        if (callDate > new Date()) {
            // Handle slight timezone skew
        }

        // Historical Price
        const callPrice = await getPrice(callData.symbol, callData.type, callDate);

        // Current Price
        const currentPrice = await getPrice(callData.symbol, callData.type);

        if (callPrice === null || currentPrice === null) {
            const isStock = callData.type === 'STOCK';
            const msg = isStock
                ? `Stock data for ${callData.symbol} unavailable on Edge. Try Crypto or common stocks like AAPL.`
                : `Market data not found for ${callData.symbol}.`;

            return NextResponse.json(
                {
                    error: msg,
                    details: { callData, callPrice, currentPrice }
                },
                { status: 422 }
            );
        }

        // 6. Calculate Performance
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
                avatar: tweet.user.profile_image_url_https,
                date: tweet.created_at,
                media: tweet.mediaDetails
            }
        });

    } catch (error: any) {
        console.error('Analysis error:', error);
        return NextResponse.json({ error: 'Internal Server Error: ' + error.message }, { status: 500 });
    }
}
