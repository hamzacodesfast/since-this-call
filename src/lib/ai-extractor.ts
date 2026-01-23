/**
 * @file ai-extractor.ts
 * @description AI-powered tweet analysis using Google Gemini
 * 
 * Uses Gemini 2.0 Flash to extract:
 * - Symbol: The asset ticker (BTC, NVDA, etc.)
 * - Type: CRYPTO or STOCK
 * - Sentiment: BULLISH or BEARISH
 * - Date: When the call was made
 * - Contract Address: For pump.fun/meme tokens
 * 
 * Key features:
 * - Multimodal: Can analyze chart images for context
 * - Doomposting detection: "cleanse", "capitulation" = BEARISH
 * - Position vs description: "chart horrible but holding" = BULLISH
 * - Regex fallback: Safety net if AI rate limited
 * 
 * @see analyzer.ts for orchestration
 */
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export const CallSchema = z.object({
    ticker: z.string().describe('The stock ticker or crypto symbol (e.g. BTC, NVDA, ETH). For pump.fun tokens, use the token name/symbol if known.'),
    action: z.enum(['BUY', 'SELL', 'NULL']).describe('The action/sentiment of the call. Use NULL if it is a conditional hypothesis or not an active call.'),
    confidence_score: z.number().min(0).max(1).describe('Confidence score from 0 to 1.'),
    timeframe: z.enum(['SHORT_TERM', 'LONG_TERM', 'UNKNOWN']).describe('The predicted timeframe.'),
    is_sarcasm: z.boolean().describe('Whether the tweet uses sarcasm or memes to convey intent.'),
    reasoning: z.string().describe('Brief explanation of the verdict.'),
    warning_flags: z.array(z.string()).describe('Any warning flags for the analysis (e.g., "HIGH_VOLATILITY", "AMBIGUOUS_TICKER").'),
    type: z.enum(['CRYPTO', 'STOCK']).describe('The type of asset.'),
    date: z.string().describe('The date of the tweet/call in ISO format (YYYY-MM-DD).'),
    contractAddress: z.string().optional().describe('Optional: Solana contract address for pump.fun or meme tokens (32-44 char base58 string).'),
});

export type CallData = z.infer<typeof CallSchema>;

// Solana base58 address regex (32-44 characters, base58 alphabet)
const SOLANA_CA_REGEX = /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g;

// Basic Regex Extraction Fallback if AI fails (Rate Limited)
// This serves as a critical safety net to keep the app functional during AI outages.
function extractWithRegex(text: string, dateStr: string, typeOverride?: 'CRYPTO' | 'STOCK'): CallData | null {

    // 1. Find Ticker/Symbol
    // Look for $BTC, $ETH, $AAPL or common names like "Bitcoin", "Apple"
    // 1. Find Ticker/Symbol
    // Look for $BTC, #BTC, or just capitalized words common in finance
    const cashtagRegex = /[\$#]([A-Za-z][A-Za-z0-9]{1,19})/g;
    const matches = [...text.matchAll(cashtagRegex)];

    let symbol = '';
    if (matches.length > 0) {
        symbol = matches[0][1].toUpperCase();
    } else {
        // Keyword matching for major assets and common names
        const lower = text.toLowerCase();
        if (lower.includes('bitcoin') || lower.includes('btc')) symbol = 'BTC';
        else if (lower.includes('ethereum') || lower.includes('eth')) symbol = 'ETH';
        else if (lower.includes('solana') || lower.includes('sol')) symbol = 'SOL';
        else if (lower.includes('tesla') || lower.includes('tsla')) symbol = 'TSLA';
        else if (lower.includes('apple') || lower.includes('aapl')) symbol = 'AAPL';
        else if (lower.includes('nvidia') || lower.includes('nvda')) symbol = 'NVDA';
        else if (lower.includes('silver') || lower.includes('slv')) symbol = 'SLV';
        else if (lower.includes('gold') || lower.includes('gld')) symbol = 'GLD';
        else if (lower.includes('microsoft') || lower.includes('msft')) symbol = 'MSFT';
        else if (lower.includes('amazon') || lower.includes('amzn')) symbol = 'AMZN';
        else if (lower.includes('palantir') || lower.includes('pltr')) symbol = 'PLTR';

        // Try strict uppercase word matching for 3-5 letter tickers
        if (!symbol) {
            const words = text.split(/\s+/);
            for (const word of words) {
                const clean = word.replace(/[^a-zA-Z0-9]/g, '');
                if (clean === clean.toUpperCase() && clean.length >= 3 && clean.length <= 5 && !['THE', 'AND', 'FOR'].includes(clean)) {
                    // Assume it's a ticker if it's ALL CAPS 3-5 Chars
                    symbol = clean;
                    break;
                }
            }
        }
    }

    if (!symbol) {
        console.warn('[AI-Extractor] Regex failed to find symbol');
        return null;
    }

    // 2. Determine Type
    // Default to CRYPTO if it was a cashtag $SYMBOL, as that's 99% of our usage
    let type: 'CRYPTO' | 'STOCK' = typeOverride || (matches.length > 0 ? 'CRYPTO' : 'STOCK');

    const cryptoList = [
        'BTC', 'ETH', 'SOL', 'DOGE', 'DOT', 'ADA', 'XRP', 'LINK', 'AVAX', 'MATIC',
        'PEPE', 'WOJAK', 'SHIB', 'BONK', 'WIF', 'FLOKI', 'BRETT', 'MOG', 'TURBO',
        'SPX', 'SPX6900', 'PENGU', 'MOODENG', 'POPCAT', 'GPY', 'HYPE', 'VIRTUAL', 'AI16Z',
        'BULLISH', 'TRUMP', 'SCRT', 'ROSE', 'PYTH', 'JUP', 'RAY', 'ONDO', 'TIA', 'SEI',
        'SUI', 'APT', 'OP', 'ARB', 'STRK', 'LDO', 'PENDLE', 'ENA', 'W', 'TNSR'
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
        ticker: symbol,
        action: sentiment === 'BULLISH' ? 'BUY' : 'SELL',
        confidence_score: 0.5,
        timeframe: 'SHORT_TERM',
        is_sarcasm: false,
        reasoning: 'Extracted via fallback regex.',
        warning_flags: ['AI_FALLBACK'],
        type,
        date: dateStr,
        contractAddress,
    };
}

/**
 * Main Extraction Function.
 * Tries Google Gemini Flash 2.0 first (with optional image analysis).
 * If Rate Limited (429) or fails, falls back to Regex extraction.
 */
export async function extractCallFromText(
    tweetText: string,
    tweetDate: string,
    imageUrl?: string,
    typeOverride?: 'CRYPTO' | 'STOCK'
): Promise<CallData | null> {
    try {
        // Build the prompt content - text + optional image
        const promptText = `
        Analyze this tweet and extract the financial "Call" (Prediction) as the Chief Linguistic Officer for "SinceThisCall."
        Your sole purpose is to disambiguate intent. Translate "FinTwit Slang," sarcasm, and memes into rigid, executable trading signals.

        Tweet Content: "${tweetText}"
        Tweet Date: "${tweetDate}"
        ${imageUrl ? '\nAn image/chart is attached. Use it to identify the asset if the text is ambiguous.' : ''}
        ${typeOverride ? `\nUSER INTENT HINT: The user has explicitly selected the asset type as ${typeOverride}. Prioritize this type and look for relevant tickers of this type.` : ''}

        YOUR CORE DIRECTIVES:

        1. Sarcasm & "Engagement Bait" Detection (The "Clown" Rule)
        - If a tweet contains 🤡, 💀, or "Imagine...", analyze if the user is mocking sellers (Bullish/BUY) or mocking buyers (Bearish/SELL).
        - "Imagine not owning BTC at this price 🤡" -> action: "BUY" (Bullish), is_sarcasm: true.

        2. Inverse Logic
        - If a user says "I am ruined," they are likely Long and the price went Down (Sentiment: BULLISH but trade went bad, look for intent).
        - If they say "Printer go brrr," they are Long and price is Up.

        3. Entity Resolution (The "Nicknames" Database)
        - Map slang terms to Ticker Symbols:
          * "HL" or "Hyperliquid" -> $HYPE
          * "Saylor's bags" -> $MSTR
          * "Vitalik's coin" -> $ETH
          * "Golden Arches" -> $MCD
          * "The dog" -> $DOGE (or $SHIB if context implies)
          * "Corn" -> $BTC (Bitcoin)

        4. Conditional Logic (The "If/Then" Trap)
        - Distinguish between an Active Call and a Conditional Hypothesis.
        - "Buying if we reclaim 40k" -> action: "NULL" (Do not generate a receipt).
        - "Aping here. Stop loss at 39k" -> action: "BUY" (Active call).

        5. Price Target Rules:
        - BTC is currently around $90k-100k. A target of "65k" = BEARISH (SELL). A target of "150k" = BULLISH (BUY).
        - If predicting a LOWER price target = SELL.
        - If predicting a HIGHER price target = BUY.

        6. Symbol Extraction:
        - Look for $SYMBOL cashtags first.
        - "SPX6900" is a CRYPTO memecoin, NOT the S&P 500 index.

        Return a valid JSON object matching the schema.
        `;

        // DEBUG: Log what we're sending to the AI
        console.log('[AI-Extractor] Tweet text:', tweetText);
        console.log('[AI-Extractor] Has image:', !!imageUrl);

        const messages: any[] = [
            {
                role: 'user', content: [
                    { type: 'text', text: promptText },
                    ...(imageUrl ? [{ type: 'image', image: imageUrl }] : [])
                ]
            }
        ];

        const { object } = await generateObject({
            model: google('models/gemini-2.0-flash-exp'), // Revert to known working model
            schema: CallSchema,
            messages: messages,
        });

        // Handle NULL action (conditional hypothesis)
        if (object.action === 'NULL') {
            console.log('[AI-Extractor] Detected conditional hypothesis (NULL action). Skipping receipt generation.');
            return null;
        }

        // DEBUG: Log what AI returned
        console.log('[AI-Extractor] AI returned:', JSON.stringify(object));

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
        return extractWithRegex(tweetText, tweetDate, typeOverride);
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
