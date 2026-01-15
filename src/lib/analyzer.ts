import { getTweet } from 'react-tweet/api';
import { extractCallFromText } from '@/lib/ai-extractor';
import { getPrice, calculatePerformance, getPriceByContractAddress, getGeckoTerminalPrice, getPairInfoByCA } from '@/lib/market-data';
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

export async function analyzeTweet(tweetId: string, contractAddressOverride?: string): Promise<AnalysisResult> {
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

    // If CA override provided (e.g., from pump.fun URL), use it
    if (contractAddressOverride) {
        console.log(`[Analyzer] Using CA override: ${contractAddressOverride}`);
        callData.contractAddress = contractAddressOverride;
        callData.type = 'CRYPTO'; // Pump.fun tokens are always crypto
    }

    // Force known stocks that might be misclassified as crypto (e.g. BMNR which has a garbage token on Base)
    const FORCE_STOCKS = ['BMNR', 'MSFT', 'GOOG', 'AMZN', 'NFLX', 'META', 'TSLA', 'NVDA', 'AMD', 'INTC'];
    if (callData.symbol && FORCE_STOCKS.includes(callData.symbol.toUpperCase()) && !contractAddressOverride) {
        console.log(`[Analyzer] Forcing ${callData.symbol} to STOCK type`);
        callData.type = 'STOCK';
    }

    // 4. Market Data Fetch
    // Use the actual Tweet Timestamp for precision, unless AI suggests a different specific date
    // But typically the "Call Date" is when the tweet was posted.
    // tweet.created_at is correct (ISO string).
    let callDate = new Date(tweet.created_at);

    // Fallback to AI date if for some reason created_at is missing (unlikely)
    if (isNaN(callDate.getTime())) {
        callDate = new Date(callData.date);
    }

    // Validation: Call Date cannot be in future (Timezones?)
    if (callDate > new Date()) {
        // Handle slight timezone skew
    }

    let callPrice: number | null = null;
    let currentPrice: number | null = null;
    let finalSymbol = callData.symbol;

    // Known tokens with CoinGecko listings - skip CA lookup to avoid fake tokens
    const COINGECKO_SYMBOLS = ['PUMP', 'ME', 'PEPE', 'WIF', 'BONK', 'PENGU', 'JUP', 'PYTH', 'JTO', 'RENDER', 'HYPE'];
    const usesCoinGecko = COINGECKO_SYMBOLS.includes(finalSymbol.toUpperCase());

    // If we have a contract address (pump.fun token) AND it's not a known CoinGecko token, use CA-based lookup
    if (callData.contractAddress && !usesCoinGecko) {
        const caData = await getPriceByContractAddress(callData.contractAddress);
        if (caData) {
            currentPrice = caData.price;

            // Update symbol from DexScreener if we got a better one
            if (caData.symbol && caData.symbol !== 'UNKNOWN') {
                finalSymbol = caData.symbol;
            }

            const tweetAgeMs = Date.now() - callDate.getTime();
            const tweetAgeHours = tweetAgeMs / (1000 * 60 * 60);

            // STEP 1: For tweets >24h old, TRY GeckoTerminal historical data FIRST
            // This ensures we get the actual tweet-time price, not a stored analysis-time price
            if (tweetAgeHours > 24) {
                console.log(`[Analyzer] Tweet is ${(tweetAgeHours / 24).toFixed(1)} days old, using GeckoTerminal for historical price`);

                const pairInfo = await getPairInfoByCA(callData.contractAddress);
                if (pairInfo) {
                    const gtPrice = await getGeckoTerminalPrice(pairInfo.chainId, pairInfo.pairAddress, callDate);
                    if (gtPrice !== null) {
                        callPrice = gtPrice;
                        console.log(`[Analyzer] GeckoTerminal historical price: $${callPrice}`);
                    }
                }
            }

            // STEP 2: For recent tweets (<=24h), use DexScreener priceChange data
            if (callPrice === null && tweetAgeHours <= 24 && caData.priceChange) {
                let percentChange: number | undefined;

                if (tweetAgeHours <= 1 && caData.priceChange.h1 !== undefined) {
                    percentChange = caData.priceChange.h1;
                } else if (tweetAgeHours <= 6 && caData.priceChange.h6 !== undefined) {
                    percentChange = caData.priceChange.h6;
                } else if (tweetAgeHours <= 24 && caData.priceChange.h24 !== undefined) {
                    percentChange = caData.priceChange.h24;
                }

                if (percentChange !== undefined && percentChange !== 0 && currentPrice !== null) {
                    callPrice = currentPrice / (1 + percentChange / 100);
                    console.log(`[Analyzer] Used DexScreener priceChange for call price: $${callPrice}`);
                }
            }

            // STEP 3: Fall back to stored historical price if nothing else worked
            if (callPrice === null) {
                const storedPrice = await getPumpfunPrice(callData.contractAddress);
                if (storedPrice) {
                    callPrice = storedPrice.price;
                    console.log(`[Analyzer] Using stored historical price: $${callPrice}`);
                }
            }

            // STEP 4: Store current price for future lookups (only if new)
            if (currentPrice !== null) {
                await storePumpfunPrice(callData.contractAddress, currentPrice, finalSymbol);
            }
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
    const performance = calculatePerformance(callPrice, currentPrice, callData.sentiment);

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
