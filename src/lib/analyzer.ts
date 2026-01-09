import { getTweet } from 'react-tweet/api';
import { extractCallFromText } from '@/lib/ai-extractor';
import { getPrice, calculatePerformance } from '@/lib/market-data';

export interface AnalysisResult {
    analysis: {
        symbol: string;
        type: 'CRYPTO' | 'STOCK';
        sentiment: 'BULLISH' | 'BEARISH';
        date: string;
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

    // 3. AI Extraction
    const callData = await extractCallFromText(tweet.text, tweet.created_at);

    if (!callData) {
        throw new Error('Could not identify financial call');
    }

    // 4. Market Data Fetch
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

        throw new Error(msg);
    }

    // 5. Calculate Performance
    const performance = calculatePerformance(callPrice, currentPrice);

    return {
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
            isEdited
        }
    };
}
