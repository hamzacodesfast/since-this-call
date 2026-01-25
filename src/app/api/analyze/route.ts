import { NextRequest, NextResponse } from 'next/server';
import { analyzeTweet } from '@/lib/analyzer';



import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({
    interval: 60 * 1000, // 60 seconds
    uniqueTokenPerInterval: 500, // Track up to 500 IPs per lambda instance
});


import { z } from 'zod';

const analyzeSchema = z.object({
    url: z.string().url(),
    type: z.enum(['CRYPTO', 'STOCK']).optional(),
    pumpfun: z.string().optional(), // Can be a URL, let's keep it loose but validated as string
    ca: z.string().regex(/^[a-zA-Z0-9]+$/).optional(),
});

export async function GET(request: NextRequest) {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    if (!limiter.check(10, ip)) { // 10 requests per minute
        return NextResponse.json(
            { error: 'Rate Limit Exceeded. Please wait a minute.' },
            { status: 429 }
        );
    }

    const { searchParams } = new URL(request.url);
    const rawParams = {
        url: searchParams.get('url'),
        type: searchParams.get('type'),
        pumpfun: searchParams.get('pumpfun'),
        ca: searchParams.get('ca'),
    };

    const validation = analyzeSchema.safeParse(rawParams);

    if (!validation.success) {
        return NextResponse.json({ error: 'Invalid input parameters', details: validation.error.format() }, { status: 400 });
    }

    const { url: tweetUrl, type: typeOverride, pumpfun: pumpfunUrl, ca: caParam } = validation.data;

    try {
        const tweetId = tweetUrl.split('/').pop()?.split('?')[0];
        if (!tweetId) {
            return NextResponse.json({ error: 'Invalid tweet URL' }, { status: 400 });
        }

        // Extract CA from pump.fun or DexScreener URL if provided
        let contractAddress: string | undefined = caParam || undefined;
        if (!contractAddress && pumpfunUrl) {
            // Parse pump.fun/coin/<CA> format
            const pumpMatch = pumpfunUrl.match(/pump\.fun\/coin\/([a-zA-Z0-9]+)/);
            if (pumpMatch) {
                contractAddress = pumpMatch[1];
                console.log(`[API] Extracted CA from pump.fun: ${contractAddress}`);
            }

            // Parse dexscreener.com/solana/<pair_address> format
            // DexScreener uses PAIR addresses in URLs, we need to fetch the actual token address
            if (!contractAddress) {
                const dexMatch = pumpfunUrl.match(/dexscreener\.com\/solana\/([a-zA-Z0-9]+)/);
                if (dexMatch) {
                    const pairAddress = dexMatch[1];
                    console.log(`[API] Found DexScreener pair address: ${pairAddress}`);

                    // Fetch the pair info to get the base token address
                    try {
                        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`);
                        if (dexRes.ok) {
                            const dexData = await dexRes.json();
                            if (dexData.pair?.baseToken?.address) {
                                contractAddress = dexData.pair.baseToken.address;
                                console.log(`[API] Resolved to token address: ${contractAddress} (${dexData.pair.baseToken.symbol})`);
                            }
                        }
                    } catch (e) {
                        console.error('[API] Failed to resolve DexScreener pair:', e);
                    }
                }
            }

            // Also handle gecko terminal: geckoterminal.com/solana/pools/<CA>
            if (!contractAddress) {
                const geckoMatch = pumpfunUrl.match(/geckoterminal\.com\/solana\/pools\/([a-zA-Z0-9]+)/);
                if (geckoMatch) {
                    contractAddress = geckoMatch[1];
                    console.log(`[API] Extracted CA from GeckoTerminal: ${contractAddress}`);
                }
            }
        }

        const result = await analyzeTweet(tweetId, contractAddress, typeOverride || undefined);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Analysis error:', error);

        // Handle specific known errors with proper codes if needed
        const status = error.message.includes('not found') ? 404 : 422;

        return NextResponse.json({ error: error.message }, { status });
    }
}
