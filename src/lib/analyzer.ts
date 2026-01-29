/**
 * @file analyzer.ts
 * @description Main analysis orchestrator for Since This Call
 * 
 * This module coordinates the full analysis pipeline:
 * 1. Fetch tweet content via react-tweet API
 * 2. AI extraction of symbol, sentiment, and type
 * 3. Symbol cleanup (strip $ prefix and common pair suffixes)
 * 4. Price lookup via market-data waterfall
 * 5. Performance calculation
 * 
 * Key features:
 * - Contract address override for pump.fun URLs
 * - Symbol/CA validation to prevent hijacking
 * - FORCE_STOCKS list for known stock tickers
 * - Refactored to support Bulk Analysis (analyzing raw tweet objects without fetching)
 * 
 * @see ai-extractor.ts for tweet parsing logic
 * @see market-data.ts for price fetching
 */
import { getTweet } from 'react-tweet/api';
import { extractCallFromText } from '@/lib/ai-extractor';
import { getPrice, calculatePerformance, getPriceByContractAddress, getGeckoTerminalPrice, getPairInfoByCA, getMajorIndicesPrices } from '@/lib/market-data';
import { getPumpfunPrice, storePumpfunPrice } from '@/lib/analysis-store';

/**
 * Clean symbol by removing $ prefix and common pair suffixes (USDT, USD, PERP)
 */
function cleanSymbol(symbol: string): string {
    let clean = symbol.replace(/^\$/, '').toUpperCase();

    const suffixes = ['USDT', 'USD', 'PERP', '.P', '.D'];
    for (const suffix of suffixes) {
        if (clean.endsWith(suffix) && clean.length > suffix.length) {
            const base = clean.slice(0, -suffix.length);
            // Clean trailing separator like BTC-USD -> BTC
            if (base.endsWith('-') || base.endsWith('/') || base.endsWith('.')) {
                clean = base.slice(0, -1);
            } else {
                clean = base;
            }
            break;
        }
    }

    return clean;
}

export interface AnalysisResult {
    analysis: {
        symbol: string;
        type: 'CRYPTO' | 'STOCK';
        sentiment: 'BULLISH' | 'BEARISH';
        date: string;
        contractAddress?: string;
        // Context Engine Fields
        ticker: string;
        action: 'BUY' | 'SELL';
        confidence_score: number;
        timeframe: 'SHORT_TERM' | 'LONG_TERM' | 'UNKNOWN';
        is_sarcasm: boolean;
        reasoning: string;
        warning_flags: string[];
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

/**
 * Core analysis logic, decoupled from fetching.
 * Use this when you already have the tweet object (e.g. bulk import).
 */
export async function analyzeTweetContent(
    tweet: any,
    contractAddressOverride?: string,
    typeOverride?: 'CRYPTO' | 'STOCK'
): Promise<AnalysisResult> {
    // 2. Anti-Cheating / Time Travel Check
    // We detect if it was edited but now we allow it with a flag.
    const isEdited = tweet.edit_info?.initial?.edit_tweet_ids?.length > 1 || tweet.isEdited || false;

    // 3. Extract first image URL if available (for multimodal analysis)
    const mediaDetails = tweet.mediaDetails || [];
    const firstImageUrl = mediaDetails.find((m: any) => m.type === 'photo')?.media_url_https;

    // 4. Fetch Market Context (Major Indices)
    const marketContext = await getMajorIndicesPrices();

    // 5. AI Extraction (with optional image for chart analysis)
    const callData = await extractCallFromText(tweet.text, tweet.created_at, firstImageUrl, typeOverride, marketContext);

    if (!callData) {
        throw new Error('Could not identify financial call');
    }

    // 5. Clean the symbol (strip $ and USDT/USD suffixes)
    const symbol = cleanSymbol(callData.ticker);

    // Map Context Engine fields
    const sentiment = callData.action === 'BUY' ? 'BULLISH' : 'BEARISH';

    // If CA override provided (e.g., from pump.fun URL), validate and use it
    if (contractAddressOverride) {
        // Validation 1: CA Mismatch
        // If tweet explicitly mentions a DIFFERENT contract address, reject it.
        if (callData.contractAddress && callData.contractAddress !== contractAddressOverride) {
            throw new Error(`Mismatch Error: Tweet mentions CA ${callData.contractAddress.slice(0, 6)}... but you provided ${contractAddressOverride.slice(0, 6)}...`);
        }

        // Validation 2: Symbol/Ticker Mismatch
        // Fetch CA details to get the REAL symbol for this address
        const overrideData = await getPriceByContractAddress(contractAddressOverride);
        if (overrideData && symbol) {
            const tweetSymbol = symbol.toUpperCase();
            const caSymbol = overrideData.symbol.toUpperCase();
            const caName = overrideData.name.toUpperCase();

            // Allow match if:
            // 1. Exact Symbol match (BRETT == BRETT)
            // 2. CA Name contains Tweet Symbol (e.g. "Brett The Dog" contains "BRETT")
            // 3. Tweet Symbol contains CA Symbol (e.g. "$BRETT" contains "BRETT")
            // 4. Special Case: Tweet detected "SOL" (chain) often happens when people say "Buy on SOL". 

            const isMatch =
                tweetSymbol === caSymbol ||
                caName.includes(tweetSymbol) ||
                tweetSymbol.includes(caSymbol);

            if (!isMatch) {
                // User explicitly provided a link, so trust their intent
                // Log warning but proceed with the user-provided token
                console.log(`[Analyzer] Warning: Tweet mentions $${tweetSymbol}, but using user-provided token $${caSymbol} (${overrideData.name})`);
            }
        }

        console.log(`[Analyzer] Using CA override: ${contractAddressOverride}`);
        callData.contractAddress = contractAddressOverride;
        callData.type = 'CRYPTO'; // Pump.fun tokens are always crypto

        // Update the symbol to the real one from the CA (fix "SOL" -> "MYTOKEN")
        if (overrideData) {
            // We'll update symbol later
        }
    }

    // Force known stocks that might be misclassified as crypto (e.g. BMNR which has a garbage token on Base)
    // ONLY if no explicit override is provided
    const FORCE_STOCKS = ['BMNR', 'MSFT', 'GOOG', 'AMZN', 'NFLX', 'META', 'TSLA', 'NVDA', 'AMD', 'INTC'];
    if (!typeOverride && symbol && FORCE_STOCKS.includes(symbol.toUpperCase()) && !contractAddressOverride) {
        console.log(`[Analyzer] Forcing ${symbol} to STOCK type`);
        callData.type = 'STOCK';
    }

    // Apply explicit override if provided
    if (typeOverride) {
        callData.type = typeOverride;
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
    let finalSymbol = symbol;

    // If we have override data, use its symbol
    if (contractAddressOverride) {
        const overrideData = await getPriceByContractAddress(contractAddressOverride);
        if (overrideData) {
            finalSymbol = overrideData.symbol;
        }
    }

    // Known tokens with CoinGecko listings - skip CA lookup to avoid fake tokens
    const COINGECKO_SYMBOLS = ['PUMP', 'ME', 'PEPE', 'WIF', 'BONK', 'PENGU', 'JUP', 'PYTH', 'JTO', 'RENDER', 'HYPE'];
    const usesCoinGecko = COINGECKO_SYMBOLS.includes(finalSymbol.toUpperCase());

    // If we have a contract address (pump.fun token) AND it's not a known CoinGecko token, use CA-based lookup
    // STOCKS should never use CA lookup
    if (callData.contractAddress && !usesCoinGecko && callData.type !== 'STOCK') {
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
    const performance = calculatePerformance(callPrice, currentPrice, sentiment);

    return {
        analysis: {
            symbol: finalSymbol,
            type: callData.type,
            sentiment,
            date: callData.date,
            contractAddress: callData.contractAddress,
            // Context Engine fields
            ticker: callData.ticker,
            action: callData.action as 'BUY' | 'SELL',
            confidence_score: callData.confidence_score,
            timeframe: callData.timeframe,
            is_sarcasm: callData.is_sarcasm,
            reasoning: callData.reasoning,
            warning_flags: callData.warning_flags,
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

export async function analyzeTweet(
    tweetId: string,
    contractAddressOverride?: string,
    typeOverride?: 'CRYPTO' | 'STOCK'
): Promise<AnalysisResult> {
    // 1. Fetch Tweet Content
    const tweet = await getTweet(tweetId);
    if (!tweet) {
        throw new Error('Tweet not found');
    }

    return analyzeTweetContent(tweet, contractAddressOverride, typeOverride);
}
