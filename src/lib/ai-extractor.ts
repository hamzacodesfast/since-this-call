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

        CRITICAL SENTIMENT RULES (READ CAREFULLY):
        
        **PRICE TARGET RULES** (MOST IMPORTANT):
        - If tweet mentions a PRICE TARGET, determine if it's ABOVE or BELOW the TYPICAL current price
        - BTC is currently around $90k-100k. A target of "65k", "60k", "50k" = BEARISH. A target of "150k", "200k" = BULLISH
        - ETH is currently around $3000-4000. A target of "2k", "1500", "1000" = BEARISH. A target of "5k", "10k" = BULLISH
        - If predicting a LOWER price target = BEARISH
        - If predicting a HIGHER price target = BULLISH
        - "Going to 65k", "target 65k", "expecting 65k", "retest 60k" on BTC = BEARISH (price going DOWN)
        
        **BEARISH INDICATORS** (mark as BEARISH if ANY of these are present):
        - "short", "shorting", "shorted"
        - "sell", "selling", "sold"
        - "dump", "dumping", "crash", "crashing"
        - "down", "going down", "lower", "drop"
        - "top is in", "the top", "topped"
        - "exit", "exiting", "closed my long"
        - "taking profits", "time to leave"
        - "reject", "rejected", "rejection"
        - "flush", "capitulation", "wipeout"
        - "retest", "fill the gap", "revisit" (when referring to a LOWER price)
        - Any prediction of price going DOWN from current levels
        
        **BULLISH INDICATORS** (mark as BULLISH only if expressing positive outlook):
        - "long", "longing", "buy", "buying", "bought"
        - "moon", "pump", "send it", "going up"
        - "accumulate", "accumulating"
        - "breakout", "breaking out"
        - "bullish", "higher highs", "new ATH"
        - Predicting price will go UP from current levels
        
        **CRITICAL: ACTION vs DESCRIPTION**:
        - FOCUS ON THE TRADER'S POSITION/ACTION, NOT THEIR DESCRIPTION OF PRICE
        - "Chart looks horrible BUT I'm holding/buying/sticking with it" = BULLISH (they are LONG despite bad chart)
        - "DCA", "accumulating", "adding", "staking" = BULLISH (they are buying more)
        - "Sticking with the trade" = BULLISH (maintaining long position)
        - Someone can describe price negatively while still being BULLISH on the trade
        - The ACTUAL POSITION matters more than commentary on current price action
        
        **KEY DISTINCTION**:
        - "Closed my long" = They expect DOWN = BEARISH
        - "Closed my short" = They expect UP = BULLISH
        - "NOT buying" or "staying out" = BEARISH stance
        - "Chart looks bad but holding" = BULLISH (position is LONG)
        
        **SYMBOL EXTRACTION**:
        - Look for $SYMBOL cashtags first
        - Common mappings: Silver/SLV, Gold/GLD, Bitcoin/BTC, Ethereum/ETH
        - For pump.fun tokens, extract the contract address (32-44 char base58 string)
        
        **TYPE**:
        - CRYPTO: BTC, ETH, SOL, DOGE, XRP, meme coins, tokens
        - STOCK: AAPL, TSLA, SPY, GLD, SLV, individual stocks, ETFs, commodities

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
            model: google('models/gemini-2.0-flash-exp'), // Revert to working model
            schema: CallSchema,
            messages: messages,
        });

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
