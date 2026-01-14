import { getTweet } from 'react-tweet/api';
import { extractCallFromText } from '@/lib/ai-extractor';
import { getPrice, calculatePerformance, getPriceByContractAddress } from '@/lib/market-data';
import { getPumpfunPrice, storePumpfunPrice } from '@/lib/analysis-store';

export interface AnalysisResult {
    analysis: {
        symbol: string;
        type: 'CRYPTO' | 'STOCK';
        sentiment: 'BULLISH' | 'BEARISH';
        date: string;
        contractAddress?: string;
    };
    market: {
        callPrice: number;
        currentPrice: number;
        performance: number;
        currency: string;
    };
    tweet: {
        id: string;
        text: string;
        author: string;
        username: string;
        avatar?: string;
        date: string;
        isEdited: boolean;
    };
}

export async function analyzeTweet(tweetId: string): Promise<AnalysisResult> {
    // 1. Fetch Tweet Content
    const tweet = await getTweet(tweetId);
    if (!tweet) {
        throw new Error('Tweet not found');
    }

    // 2. Anti-Cheating / Time Travel Check
    // We detect if it was edited but now we allow it with a flag.
    const isEdited = (tweet as any).edit_info?.initial?.edit_tweet_ids?.length > 1 || (tweet as any).isEdited || false;

    // 3. Extract first image URL if available (for multimodal analysis)
    const mediaDetails = (tweet as any).mediaDetails || [];
    const firstImageUrl = mediaDetails.find((m: any) => m.type === 'photo')?.media_url_https;

    // 4. AI Extraction (with optional image for chart analysis)
    const callData = await extractCallFromText(tweet.text, tweet.created_at, firstImageUrl);

    if (!callData) {
        throw new Error('Could not identify financial call');
    }

    // 4. Market Data Fetch
    const callDate = new Date(callData.date);

    // Validation: Call Date cannot be in future (Timezones?)
    if (callDate > new Date()) {
        // Handle slight timezone skew
    }

    let callPrice: number | null = null;
    let currentPrice: number | null = null;
    let finalSymbol = callData.symbol;

    // If we have a contract address (pump.fun token), use CA-based lookup
    if (callData.contractAddress) {
        const caData = await getPriceByContractAddress(callData.contractAddress);
        if (caData) {
            currentPrice = caData.price;

            // Update symbol from DexScreener if we got a better one
            if (caData.symbol && caData.symbol !== 'UNKNOWN') {
                finalSymbol = caData.symbol;
            }

            // STEP 1: Check if we have a stored historical price in Redis
            const storedPrice = await getPumpfunPrice(callData.contractAddress);
            if (storedPrice) {
                // Use stored first-seen price as call price
                callPrice = storedPrice.price;
            } else {
                // STEP 2: No stored price - try DexScreener priceChange data
                const tweetAgeMs = Date.now() - callDate.getTime();
                const tweetAgeHours = tweetAgeMs / (1000 * 60 * 60);

                if (caData.priceChange) {
                    let percentChange: number | undefined;

                    // ONLY use priceChange if tweet is within the appropriate timeframe
                    // Using h24 for a 20-day old tweet would give completely wrong data!
                    if (tweetAgeHours <= 1 && caData.priceChange.h1 !== undefined) {
                        percentChange = caData.priceChange.h1;
                    } else if (tweetAgeHours <= 6 && caData.priceChange.h6 !== undefined) {
                        percentChange = caData.priceChange.h6;
                    } else if (tweetAgeHours <= 24 && caData.priceChange.h24 !== undefined) {
                        percentChange = caData.priceChange.h24;
                    }
                    // NOTE: We do NOT fall back to h24 for older tweets - that would be incorrect!

                    if (percentChange !== undefined && percentChange !== 0) {
                        // Calculate historical price from priceChange
                        callPrice = currentPrice / (1 + percentChange / 100);
                    } else {
                        // Tweet is too old for DexScreener price change data
                        throw new Error(`Historical data unavailable for pump.fun token ${finalSymbol}. Only tweets < 24 hours old can be analyzed. This tweet is ${Math.round(tweetAgeHours)} hours old.`);
                    }
                } else {
                    throw new Error(`Price history unavailable for pump.fun token ${finalSymbol}.`);
                }
            }

            // STEP 3: Store current price for future lookups (only if new)
            await storePumpfunPrice(callData.contractAddress, currentPrice, finalSymbol);
        }
    }

    // Fallback to regular price lookup if CA lookup failed or no CA
    if (callPrice === null || currentPrice === null) {
        callPrice = await getPrice(finalSymbol, callData.type, callDate);
        currentPrice = await getPrice(finalSymbol, callData.type);
    }

    if (callPrice === null || currentPrice === null) {
        const isStock = callData.type === 'STOCK';
        const msg = isStock
            ? `Stock data for ${finalSymbol} unavailable on Edge. Try Crypto or common stocks like AAPL.`
            : `Market data not found for ${finalSymbol}.`;

        throw new Error(msg);
    }

    // 5. Calculate Performance
    const performance = calculatePerformance(callPrice, currentPrice);

    return {
        analysis: {
            symbol: finalSymbol,
            type: callData.type,
            sentiment: callData.sentiment,
            date: callData.date,
            contractAddress: callData.contractAddress,
        },
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
            isEdited
        }
    };
}
