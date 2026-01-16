import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export const CallSchema = z.object({
    symbol: z.string().describe('The stock ticker or crypto symbol (e.g. BTC, NVDA, ETH). For pump.fun tokens, use the token name/symbol if known.'),
    type: z.enum(['CRYPTO', 'STOCK']).describe('The type of asset.'),
    sentiment: z.enum(['BULLISH', 'BEARISH']).describe('The sentiment of the call.'),
    date: z.string().describe('The date of the tweet/call in ISO format (YYYY-MM-DD).'),
    contractAddress: z.string().optional().describe('Optional: Solana contract address for pump.fun or meme tokens (32-44 char base58 string).'),
});

export type CallData = z.infer<typeof CallSchema>;

// Solana base58 address regex (32-44 characters, base58 alphabet)
const SOLANA_CA_REGEX = /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g;

// Known pump.fun indicators
const PUMP_FUN_INDICATORS = ['pump.fun', 'pumpfun', 'bonding curve', 'launched on pump', 'CA:'];


// Basic Regex Extraction Fallback if AI fails (Rate Limited)
// This serves as a critical safety net to keep the app functional during AI outages.
function extractWithRegex(text: string, dateStr: string): CallData | null {

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
        'PEPE', 'WOJAK', 'SHIB', 'BONK', 'WIF', 'FLOKI', 'BRETT', 'MOG', 'TURBO',
        'SPX', 'SPX6900', 'PENGU', 'MOODENG', 'POPCAT', 'GPY', 'HYPE', 'VIRTUAL', 'AI16Z'
    ];

    if (!symbol) {
        // Fallback: Check for uppercase words matching known crypto tickers
        const words = text.split(/\s+/);
        for (const word of words) {
            // Remove punctuation
            const clean = word.replace(/[^a-zA-Z0-9]/g, '');
            if (cryptoList.includes(clean.toUpperCase())) {
                symbol = clean.toUpperCase();
                break;
            }
        }
    }

    if (!symbol) {
        // console.warn('[AI-Extractor] Regex failed to find symbol');
        // Don't fail silently, return null so caller knows.
        return null;
    }

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

    // Check for Solana contract address (pump.fun tokens)
    let contractAddress: string | undefined;
    const caMatches = [...text.matchAll(SOLANA_CA_REGEX)];
    if (caMatches.length > 0) {
        // Filter out common false positives (short strings that aren't CAs)
        const validCAs = caMatches.map(m => m[1]).filter(ca =>
            ca.length >= 32 &&
            ca.length <= 44 &&
            !/^[0-9]+$/.test(ca) // Not all numbers
        );
        if (validCAs.length > 0) {
            contractAddress = validCAs[0];
            // If we found a CA but no symbol, use a placeholder
            if (!symbol) {
                symbol = 'PUMPFUN';
                type = 'CRYPTO';
            }
        }
    }

    return {
        symbol,
        type,
        sentiment,
        date: dateStr,
        contractAddress,
    };
}

/**
 * Main Extraction Function.
 * Tries Google Gemini Flash 2.0 first (with optional image analysis).
 * If Rate Limited (429) or fails, falls back to Regex extraction.
 */
export async function extractCallFromText(tweetText: string, tweetDate: string, imageUrl?: string): Promise<CallData | null> {
    try {
        // Build the prompt content - text + optional image
        const promptText = `
        Analyze this tweet and extract the financial "Call" (Prediction).
        Tweet Content: "${tweetText}"
        Tweet Date: "${tweetDate}"
        ${imageUrl ? '\nAn image/chart is attached. Use it to identify the asset if the text is ambiguous.' : ''}

        Rules:
        1. Identify the Main Asset. Use these symbol mappings:
           - **PUMP.FUN TOKENS**: If the tweet contains a Solana contract address (32-44 character base58 string) or mentions pump.fun, extract the contract address. Use the token name as symbol if mentioned, otherwise use the token's ticker.
           - **PRECIOUS METALS** (ALWAYS type="STOCK"):
             - Silver, XAG, $SILVER, $SLV, "spot silver", silver chart, SI futures -> symbol="SLV"
             - Gold, XAU, $GOLD, $GLD, "spot gold", gold chart, GC futures -> symbol="GLD"
             - **CHART ANALYSIS**: If the attached image shows a TradingView chart, READ THE TICKER from the chart title. "COMEX:SI1!" or "SI" = Silver. "GC" = Gold.
             - **PRICE DISAMBIGUATION**: Prices $20-$60 range = SILVER (SLV). Prices $1500-$3000 range = GOLD (GLD).
           - **MEME COINS** (type="CRYPTO"):
             - SPX6900, $SPX (in crypto context) -> symbol="SPX6900", type="CRYPTO". This is a MEME COIN, NOT the S&P 500 index.
             - If the tweet mentions "Cryptocurrency", "crypto", "meme coin", "degen", it is ALWAYS type="CRYPTO".
           - **CRYPTO** (type="CRYPTO"): BTC, ETH, SOL, DOGE, XRP, PEPE, etc.
           - **STOCKS** (type="STOCK"): AAPL, NVDA, TSLA, SPY (S&P 500 ETF), etc.
        2. Determine Sentiment. Strict Rules:
           - **TIMEFRAME**: Determine the IMMEDIATE direction from the tweet time.
           - **"IT'S X's TURN"**: Phrases like "It's ETH turn now", "ETH's turn", "X season" are **BULLISH** rotation calls. They predict the asset will outperform.
           - If they say "Pump THEN Dump", "Liquidation hunt above X", or "Squeeze to Y", it is **BULLISH** (calls for price increase first).
           - "This pump is not mythologia" or "This is real" = **BULLISH**.
           - If they describe "sidelined" people buying higher -> **BULLISH** (implies price is going up to them).
           - **CRITICAL**: The word "liquidated" is only BEARISH if the author thinks price is crashing NOW. If they say "bears get liquidated" or "late longs get liquidated HIGHER", it is **BULLISH**.
           - If the author is mocking "late buyers" or "sidelined bros" for MISSING the move, it is **BULLISH**.
           - Only mark **BEARISH** if the IMMEDIATE next move is down.
           - Simple "Buying", "Long", "Moon", "Send it" = BULLISH.
        3. Additional Sentiment Guidelines:
           - "Long", "Buy", "Moon", "Send it", "Higher", "Accumulate", "Breakout" -> BULLISH
           - "Short", "Sell", "Dump", "Lower", "Top is in", "Crash" -> BEARISH
           - **CAPITULATION/CLEANSE LANGUAGE**: Terms like "cleanse", "flush", "capitulation", "wipeout", "final drop", "sub-X price" (e.g. "3 fig eth") usually imply the price needs to go LOWER before a bottom. This is **BEARISH** in the short term, even if long-term bullish.
           - "3 fig eth" means ETH < $1000. If current price is > $1000, this is a prediction of a ~70% drop -> BEARISH.

        3. Extract Date: Use the provided date.
        4. Extract Contract Address (CA): If a Solana address (base58, 32-44 chars) is present, include it.
        5. Asset Type:
           - Crypto/Coins/Tokens -> CRYPTO
           - Stocks/Indices/ETFs/Metals -> STOCK

        Return a valid JSON object matching the schema.
        `;

        const messages: any[] = [
            {
                role: 'user', content: [
                    { type: 'text', text: promptText },
                    ...(imageUrl ? [{ type: 'image', image: imageUrl }] : [])
                ]
            }
        ];

        const { object } = await generateObject({
            model: google('models/gemini-2.0-flash-exp'), // Revert to working model
            schema: CallSchema,
            messages: messages,
        });

        // Post-processing for Solana CA to ensure it's captured
        if (object && !object.contractAddress) {
            const extractedCA = extractSolanaCA(tweetText);
            if (extractedCA) {
                console.log(`[AI-Extractor] AI missed CA, regex found it: ${extractedCA}`);
                object.contractAddress = extractedCA;
                // If AI got generic symbol like "SOL", try to refine it later (handled in analyzer)
            }
        }

        return object;

    } catch (error) {
        console.error('[AI-Extractor] AI failed (Rate Limit or Error), falling back to Regex:', error);
        // Fallback to Regex extraction
        return extractWithRegex(tweetText, tweetDate);
    }
}

/**
 * Helper function to extract Solana Contract Address using regex.
 */
function extractSolanaCA(text: string): string | null {
    const caMatches = [...text.matchAll(SOLANA_CA_REGEX)];
    if (caMatches.length > 0) {
        const validCAs = caMatches.map(m => m[1]).filter(ca =>
            ca.length >= 32 &&
            ca.length <= 44 &&
            !/^[0-9]+$/.test(ca) // Not all numbers
        );
        if (validCAs.length > 0) {
            return validCAs[0];
        }
    }
    return null;
}
