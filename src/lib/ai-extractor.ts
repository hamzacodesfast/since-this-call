/**
 * @file ai-extractor.ts
 * @description AI-powered tweet analysis using Google Gemini
 */
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export const CallSchema = z.object({
    ticker: z.string().describe('The stock ticker or major crypto symbol (e.g. BTC, NVDA, ETH).'),
    action: z.enum(['BUY', 'SELL', 'NULL']).describe('The action/sentiment of the AUTHOR of the tweet. Return what the AUTHOR thinks (BUY/SELL). Use NULL if it is not an active call.'),
    confidence_score: z.number().min(0).max(1).describe('Confidence score.'),
    timeframe: z.enum(['SHORT_TERM', 'LONG_TERM', 'UNKNOWN']).describe('Predicted timeframe.'),
    is_sarcasm: z.boolean().describe('Whether the tweet uses sarcasm.'),
    reasoning: z.string().describe('Brief explanation.'),
    warning_flags: z.array(z.string()).describe('Warning flags.'),
    type: z.enum(['CRYPTO', 'STOCK']).describe('Asset type.'),
    date: z.string().describe('ISO date of the call.'),
});

export type CallData = z.infer<typeof CallSchema>;

export async function extractCallFromText(
    tweetText: string,
    tweetDate: string,
    username?: string,
    imageUrl?: string,
    typeOverride?: 'CRYPTO' | 'STOCK',
    marketContext?: Record<string, number>
): Promise<CallData | null> {

    try {
        // 0. Pre-filter Noise (Deterministic)
        const upperText = tweetText.toUpperCase();
        const NOISE_PHRASES = [
            'LIVE SHOW', 'LIVE NOW', 'JOIN US', 'STREAMING NOW', 'TWITTER SPACE', 'BREAKING NEWS',
            'TRADE OF THE WEEK', 'WEEKLY RECAP'
        ];

        if (NOISE_PHRASES.some(phrase => upperText.includes(phrase))) {
            console.log('[AI-Extractor] Blocked by Noise Filter:', tweetText.substring(0, 50));
            return null;
        }

        const promptText = `
        ROLE:
        You are a financial analyst extracting signals for professional investors. 
        We ONLY track major assets found on Yahoo Finance, CoinMarketCap, or CoinGecko.

        TWEET INFO:
        Tweet Content: "${tweetText}"
        Tweet Author: "${username || 'Unknown'}"
        Tweet Date: "${tweetDate}"
        
        DIRECTIVES (HIGHEST PRIORITY):
        1. Action: BUY (Active Long), SELL (Active Short), NULL (No trade).
           - **PETER SCHIFF RULE**: If the author is "PeterSchiff", any mention of Bitcoin, BTC, or MSTR is ALWAYS Action: "SELL". 
           - He is a perma-bear. Do NOT inverse him. Do NOT interpret him sarcastically. If he says "sell the rip", it is a SELL.
        2. Ticker: Return pure symbol (e.g. BTC, HYPE, MSTR). For Nvidia, ALWAYS use "NVDA" (never NVDAX).
        3. Sentiment Analysis: Handle sarcasm and slang as signals for AUTHOR intent.
        
        NEGATIVE CONSTRAINTS (RETURN action: "NULL"):
        - Meme coins / Dex-only tokens (NULL).
        - Live shows / News Agenda (NULL).
        - Fact stating only (NULL).
        - Ambiguous / Two-sided (NULL).
        - Conditional "If/Then" (NULL).

        BULLISH SIGNALS:
        - "Target $[Price高于现价]", "Road to $[Price高于现价]".
        - "Corn is king", "Send it", "Accumulating", "Bidding", "Scooping".
        - "Bottom is in", "Ready for takeoff", "Breaking out", "Hold support".
        - "NW invested", "Betting the farm", "Generational opportunity".
        - **CONTRARIAN**: "Inverse Cramer", "Blood in the streets", "Panic selling". (Do NOT use this for Peter Schiff).

        BEARISH SIGNALS:
        - "Cooked", "Trash", "Dumpster fire", "Toxic", "Ponzi", "Bubble".
        - "Sell the rip", "Sell the bounce", "Ring the register", "Take profits".
        - "New lows", "Breakdown", "Lost support", "Rising wedge", "Bear flag".
        - "Still holding shorts", "Haven't covered".
        - "I tried to warn you", "Financial illiteracy".

        CONFLICT RESOLUTION:
        - Numerical direction ALWAYS overrides emotional slang. 
        - If Target < Current Price -> Action: SELL.
        `;

        const models = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-pro-latest'];
        let lastErr;
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        const generate = async (modelName: string) => {
            return await generateObject({
                model: google(modelName),
                schema: CallSchema,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: promptText },
                        ...(imageUrl ? [{ type: 'image', image: imageUrl }] : [])
                    ]
                } as any],
            });
        };

        for (const model of models) {
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const { object } = await generate(model);
                    if (object.action === 'NULL') return null;
                    return object;
                } catch (err: any) {
                    lastErr = err;
                    if (err.message?.includes('Quota') || err.message?.includes('429')) {
                        await delay((attempt + 1) * 2000);
                        continue;
                    }
                    break;
                }
            }
        }
        throw lastErr || new Error('Failed to analyze tweet.');
    } catch (error: any) {
        console.error('[AI-Extractor] Fatal:', error);
        throw new Error('Failed to analyze tweet. The AI service is currently unavailable.');
    }
}
