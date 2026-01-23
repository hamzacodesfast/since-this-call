import { NextRequest, NextResponse } from 'next/server';
import { analyzeTweet } from '@/lib/analyzer';



import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({
    interval: 60 * 1000, // 60 seconds
    uniqueTokenPerInterval: 500, // Track up to 500 IPs per lambda instance
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
    const tweetUrl = searchParams.get('url');
    const pumpfunUrl = searchParams.get('pumpfun'); // Optional: pump.fun/coin/<CA> URL
    const caParam = searchParams.get('ca'); // Optional: Direct CA override

    if (!tweetUrl) {
        return NextResponse.json({ error: 'Missing tweet URL' }, { status: 400 });
    }

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

        const result = await analyzeTweet(tweetId, contractAddress);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Analysis error:', error);

        // Handle specific known errors with proper codes if needed
        const status = error.message.includes('not found') ? 404 : 422;

        return NextResponse.json({ error: error.message }, { status });
    }
}
