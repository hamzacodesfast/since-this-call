import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export const CallSchema = z.object({
    symbol: z.string().describe('The stock ticker or crypto symbol (e.g. BTC, NVDA, ETH).'),
    type: z.enum(['CRYPTO', 'STOCK']).describe('The type of asset.'),
    sentiment: z.enum(['BULLISH', 'BEARISH']).describe('The sentiment of the call.'),
    date: z.string().describe('The date of the tweet/call in ISO format (YYYY-MM-DD).'),
});

export type CallData = z.infer<typeof CallSchema>;


// Basic Regex Extraction Fallback if AI fails (Rate Limited)
// This serves as a critical safety net to keep the app functional during AI outages.
function extractWithRegex(text: string, dateStr: string): CallData | null {
    console.log('[AI-Extractor] Attempting Regex Fallback...');

    // 1. Find Ticker/Symbol
    // Look for $BTC, $ETH, $AAPL or common names like "Bitcoin", "Apple"
    const cashtagRegex = /\$([A-Za-z]{2,6})/g;
    const matches = [...text.matchAll(cashtagRegex)];

    let symbol = '';
    if (matches.length > 0) {
        symbol = matches[0][1].toUpperCase();
    } else {
        // Simple keyword matching for major assets
        const lower = text.toLowerCase();
        if (lower.includes('bitcoin') || lower.includes('btc')) symbol = 'BTC';
        else if (lower.includes('ethereum') || lower.includes('eth')) symbol = 'ETH';
        else if (lower.includes('solana') || lower.includes('sol')) symbol = 'SOL';
        else if (lower.includes('tesla') || lower.includes('tsla')) symbol = 'TSLA';
        else if (lower.includes('apple') || lower.includes('aapl')) symbol = 'AAPL';
        else if (lower.includes('nvidia') || lower.includes('nvda')) symbol = 'NVDA';
        else if (lower.includes('silver') || lower.includes('slv')) symbol = 'SLV';
        else if (lower.includes('gold') || lower.includes('gld')) symbol = 'GLD';
    }

    if (!symbol) {
        console.warn('[AI-Extractor] Regex failed to find symbol');
        return null;
    }

    // 2. Determine Type
    // Naive classification based on known crypto tickers. Default is STOCK.
    let type: 'CRYPTO' | 'STOCK' = 'STOCK';
    const cryptoList = [
        'BTC', 'ETH', 'SOL', 'DOGE', 'DOT', 'ADA', 'XRP', 'LINK', 'AVAX', 'MATIC',
        'PEPE', 'WOJAK', 'SHIB', 'BONK', 'WIF', 'FLOKI', 'BRETT', 'MOG', 'TURBO'
    ];
    if (cryptoList.includes(symbol)) {
        type = 'CRYPTO';
    }

    // 3. Determine Sentiment
    // Simple score-based keyword matching.
    let sentiment: 'BULLISH' | 'BEARISH' = 'BULLISH'; // Default assumption
    const lowerText = text.toLowerCase();

    // Expanded list of bearish terms to catch nuances like "short", "crash", "puts"
    const bearishTerms = ['sell', 'dump', 'crash', 'short', 'bear', 'down', 'worth 0', 'zero', 'dead', 'falling', 'underperforming', 'puts', 'overvalued', 'late', 'top', 'exit', '💩', 'shit', 'scam', 'rug', 'bagholder'];
    const bullishTerms = ['buy', 'long', 'bull', 'moon', 'pump', 'high', 'rocket', 'parabolic', 'gem', 'next 100x'];

    let bullScore = 0;
    let bearScore = 0;

    const countOccurrences = (target: string, term: string) => {
        return target.split(term).length - 1;
    };

    bullishTerms.forEach(t => { bullScore += countOccurrences(lowerText, t); });
    bearishTerms.forEach(t => { bearScore += countOccurrences(lowerText, t); });

    if (bearScore > bullScore) sentiment = 'BEARISH';

    // Special case for Taleb's famous "worth 0" tweet or similar definitive statements
    if (text.includes('worth 0')) sentiment = 'BEARISH';

    return {
        symbol,
        type,
        sentiment,
        date: dateStr // Use tweet date
    };
}

/**
 * Main Extraction Function.
 * Tries Google Gemini Flash 2.0 first.
 * If Rate Limited (429) or fails, falls back to Regex extraction.
 */
export async function extractCallFromText(tweetText: string, tweetDate: string): Promise<CallData | null> {
    try {
        const { object } = await generateObject({
            model: google('models/gemini-2.0-flash-exp'),
            schema: CallSchema,
            prompt: `
        Analyze this tweet and extract the financial "Call" (Prediction).
        Tweet Content: "${tweetText}"
        Tweet Date: "${tweetDate}"

        Rules:
        1. Identify the Main Asset. Use these symbol mappings:
           - **PRECIOUS METALS** (ALWAYS type="STOCK"):
             - Silver, XAG, $SILVER -> symbol="SLV"
             - Gold, XAU, $GOLD -> symbol="GLD"
           - **CRYPTO** (type="CRYPTO"): BTC, ETH, SOL, DOGE, XRP, etc.
           - **STOCKS** (type="STOCK"): AAPL, NVDA, TSLA, etc.
        2. Determine Sentiment. Strict Rules:
           - **CRITICAL**: If the author is mocking "late buyers", "the crowd", "retail", or "calls them poop/shit", this is a TOP SIGNAL -> **BEARISH**.
           - **TIE-BREAKER**: If the tweet contains BOTH bullish words (like "generational", "parabolic") AND mocking of buyers, the MOCKING takes precedence. Mark as **BEARISH**.
           - "Parabolic" is Bullish ONLY if the author is participating.
           - Simple "Buying", "Long", "Moon", "Send it" = BULLISH.
        3. Use the Tweet Date as the Date.
        4. Normalize Symbol to the mappings above.
      `,
        });

        return object;
    } catch (error) {
        console.error('AI Extraction Failed:', error);
        // Fallback to regex if AI fails (e.g. 429 Rate Limit)
        return extractWithRegex(tweetText, tweetDate);
    }
}
