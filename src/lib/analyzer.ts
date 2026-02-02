/**
 * @file analyzer.ts
 * @description Main analysis orchestrator for Since This Call
 * 
 * Pipelines: Tweet Fetch -> AI Extraction -> Symbol Cleanup -> Price Lookup (Major) -> Performance.
 */
import { getTweet } from 'react-tweet/api';
import { extractCallFromText } from '@/lib/ai-extractor';
import { getPrice, calculatePerformance, getMajorIndicesPrices } from '@/lib/market-data';

function cleanSymbol(symbol: string): string {
    let clean = symbol.replace(/^\$/, '').toUpperCase();
    const suffixes = ['USDT', 'USD', 'PERP', '.P', '.D'];
    for (const suffix of suffixes) {
        if (clean.endsWith(suffix) && clean.length > suffix.length) {
            const base = clean.slice(0, -suffix.length);
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

export async function analyzeTweetContent(
    tweet: any,
    typeOverride?: 'CRYPTO' | 'STOCK'
): Promise<AnalysisResult> {
    const isEdited = tweet.edit_info?.initial?.edit_tweet_ids?.length > 1 || tweet.isEdited || false;
    const mediaDetails = tweet.mediaDetails || [];
    const firstImageUrl = mediaDetails.find((m: any) => m.type === 'photo')?.media_url_https;
    const marketContext = await getMajorIndicesPrices();

    console.log(`[Analyzer] Extracting from text: "${tweet.text?.substring(0, 50)}..."`);
    const callData = await extractCallFromText(tweet.text, tweet.created_at, firstImageUrl, typeOverride, marketContext);

    if (!callData) {
        console.error(`[Analyzer] AI failed to identify call in text: "${tweet.text}"`);
        throw new Error('Could not identify financial call');
    }

    const symbol = cleanSymbol(callData.ticker);
    const sentiment = callData.action === 'BUY' ? 'BULLISH' : 'BEARISH';

    let finalType = typeOverride || callData.type;
    const FORCE_STOCKS = ['BMNR', 'MSFT', 'GOOG', 'AMZN', 'NFLX', 'META', 'TSLA', 'NVDA', 'AMD', 'INTC', 'CRCL', 'SILVER', 'GOLD', 'USO'];
    if (symbol && FORCE_STOCKS.includes(symbol.toUpperCase())) {
        finalType = 'STOCK';
    }

    const FORCE_CRYPTO = ['BTC', 'ETH', 'SOL', 'PEPE', 'WIF', 'BONK', 'DOGE', 'XRP', 'CHZ', 'ZEN', 'ZEC', 'TAO', 'ASTER', 'ASTR', 'WLFI'];
    if (symbol && FORCE_CRYPTO.includes(symbol.toUpperCase())) {
        finalType = 'CRYPTO';
    }

    let callDate = new Date(tweet.created_at);
    if (isNaN(callDate.getTime())) callDate = new Date(callData.date);

    const callPrice = await getPrice(symbol, finalType, callDate);
    const currentPrice = await getPrice(symbol, finalType);

    if (callPrice === null || currentPrice === null) {
        throw new Error(`Market data not found for ${symbol}. We only support major assets listed on Yahoo Finance, CMC, or CoinGecko.`);
    }

    const performance = calculatePerformance(callPrice, currentPrice, sentiment);

    return {
        analysis: {
            symbol,
            type: finalType,
            sentiment,
            date: callData.date,
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

export async function analyzeTweet(tweetId: string, typeOverride?: 'CRYPTO' | 'STOCK', symbolOverride?: string, sentimentOverride?: 'BULLISH' | 'BEARISH'): Promise<AnalysisResult> {
    const tweet = await getTweet(tweetId);
    if (!tweet) throw new Error('Tweet not found');

    let result: AnalysisResult;

    if (symbolOverride && sentimentOverride) {
        // Optimization: Skip AI if we already have the call data via overrides
        const symbol = symbolOverride.toUpperCase();
        const finalType = typeOverride || 'CRYPTO'; // Default or override

        const callDate = new Date(tweet.created_at);
        const callPrice = await getPrice(symbol, finalType, callDate);
        const currentPrice = await getPrice(symbol, finalType);

        if (callPrice === null || currentPrice === null) {
            throw new Error(`Market data not found for ${symbol}. We only support major assets listed on Yahoo Finance, CMC, or CoinGecko.`);
        }

        const performance = calculatePerformance(callPrice, currentPrice, sentimentOverride);
        const isEdited = tweet.text.includes('(edited)'); // Simple heuristic for manual block

        result = {
            analysis: {
                symbol,
                type: finalType,
                sentiment: sentimentOverride,
                date: tweet.created_at,
                ticker: symbol,
                action: sentimentOverride === 'BULLISH' ? 'BUY' : 'SELL',
                confidence_score: 1.0,
                timeframe: 'UNKNOWN',
                is_sarcasm: false,
                reasoning: 'Manual override (Bypassed AI)',
                warning_flags: [],
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

        return result;
    }

    // Normal path: Use AI
    result = await analyzeTweetContent(tweet, typeOverride);

    // Apply overrides on top of AI results if only one is provided
    if (symbolOverride) {
        result.analysis.symbol = symbolOverride.toUpperCase();
        result.analysis.ticker = symbolOverride.toUpperCase();

        // Re-calculate market data for new symbol
        let callDate = new Date(tweet.created_at);
        const callPrice = await getPrice(result.analysis.symbol, result.analysis.type, callDate);
        const currentPrice = await getPrice(result.analysis.symbol, result.analysis.type);

        if (callPrice !== null && currentPrice !== null) {
            result.market.callPrice = callPrice;
            result.market.currentPrice = currentPrice;
            result.market.performance = calculatePerformance(callPrice, currentPrice, result.analysis.sentiment);
        }
    }

    if (sentimentOverride) {
        result.analysis.sentiment = sentimentOverride;
        result.analysis.action = sentimentOverride === 'BULLISH' ? 'BUY' : 'SELL';

        // Recalculate performance with new sentiment
        result.market.performance = calculatePerformance(result.market.callPrice, result.market.currentPrice, result.analysis.sentiment);
    }

    return result;
}
