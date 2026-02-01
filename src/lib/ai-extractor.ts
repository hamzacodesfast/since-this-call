/**
 * @file ai-extractor.ts
 * @description AI-powered tweet analysis using Google Gemini
 */
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export const CallSchema = z.object({
    ticker: z.string().describe('The stock ticker or major crypto symbol (e.g. BTC, NVDA, ETH).'),
    action: z.enum(['BUY', 'SELL', 'NULL']).describe('The action/sentiment of the call. Use NULL if it is not an active call or if it is a MEME COIN / DEX-only token.'),
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
    imageUrl?: string,
    typeOverride?: 'CRYPTO' | 'STOCK',
    marketContext?: Record<string, number>
): Promise<CallData | null> {

    try {
        const btcPrice = marketContext?.['BTC'] || 90000;

        const promptText = `
        ROLE:
        You are a financial analyst extracting signals for professional investors. 
        We ONLY track major assets found on Yahoo Finance, CoinMarketCap, or CoinGecko.
        - INDEX SYMBOLS: Symbols like $SPX, $ES, $NDX, $NQ, $DJI, and $RUT are MAJOR ASSETS and MUST be tracked (they map to ^GSPC, ES=F, ^NDX, NQ=F, ^DJI, ^RUT).

        CRITICAL DIRECTIVE:
        If the tweet is about a MEME COIN, a PUMP.FUN token, or a low-cap DEX-only token (e.g. anything not in the top 500 by market cap or listed on major centralized exchanges), you MUST return action: "NULL".
        We do NOT track "moonshots", "shilling", or any unlisted "gems". 

        Tweet Content: "${tweetText}"
        Tweet Date: "${tweetDate}"
        
        DIRECTIVES:
        1. Action: BUY (Active Long/Spot position), SELL (Active Short position), NULL (No trade, factual reporting, conditional, or meme coin).
        2. Ticker: Return pure symbol (e.g. BTC, ETH, MSTR).
        3. Sentiment Analysis: Handle sarcasm, memes, and slang as signals for MAJOR assets only.
        4. If it is a meme coin like $WIF, $BONK, $PEPE, or any other "fun" token, use NULL unless you are certain it is a major market leader found on major centralized exchanges (though leaning towards NULL is safer if in doubt).

        NEGATIVE CONSTRAINTS (CRITICAL - RETURN action: "NULL"):
        1. FACT STATING / DATA ONLY: If the tweet only reports data (e.g., "Volume is huge", "RSI is oversold", "Open Interest is rising") without the author explicitly stating they are BUYING or SELLING, you MUST return NULL. DO NOT infer direction from volume or indicators.
        2. AMBIGUOUS / TWO-SIDED: If the author says "Could go both ways", "Waiting for a break", or "Up or down", return NULL.
        3. CONDITIONAL / IF-THEN: "Buying if [level] breaks" or "Selling if [event] happens" MUST return NULL. We only track active positions or immediate calls.
        4. VAGUE BULLISHNESS: "This looks interesting", "Eyes on this", or "Watching this" without a definitive "Long" or "Buy" signal MUST return NULL.
        5. LACK OF CONTEXT: If the tweet is just a ticker symbol and a chart without any text indicating an active trade, return NULL.

        EXAMPLES OF NULL SIGNALS:
        - "Silver volume is exploding on the hourly." -> action: "NULL" (Just data)
        - "Could go up, could go down." -> action: "NULL" (Ambiguous)
        - "Buying $BTC if weekly closes above 100k." -> action: "NULL" (Conditional)
        - "$ETH RSI is zero." -> action: "NULL" (Data only)
        - "I'm watching $MSTR closely." -> action: "NULL" (No active call)

        BULLISH TARGETS & SLANG:
        - Phrases like "Just give me $[Price Target]", "Road to $[Price Target]", or "Price target $[Price Target]" on a major asset are BULLISH (BUY).
        - SLANG: Bullish metaphors like "poppin'", "bouncing", "trampoline", "rocket", "moon", or "to the upside" are signals for an active outlook.
        - Example: "$TSLA poppin' a bit in after hrs" -> action: "BUY"
        - Example: "$BABA ... Just give me $200. Don't make me whip out the trampoline" -> action: "BUY"

        GURU RHETORIC (BULLISH):
        - Rhetorical questions from influential accounts like "We buying here?", "Who's with me?", or "Ready to scoop?" on a major asset before news or a breakout are BULLISH (BUY).
        - SUPPORT SIGNALS: Phrases like "Buyers held", "Held up well", "Support confirmed", or "Phew" after a dip are BULLISH (BUY).
        - Example: "$AAPL $259. Held up well today despite QQQ down almost 2%." -> action: "BUY"
        - Example: "$SOFI reports tomorrow. We buying here fam?" -> action: "BUY"
        - Example: "$SPX 6000. $ES 6000. Phew. Buyers held. Just barely." -> action: "BUY" (Support confirmation)

        GAP FILLS & TARGETS:
        - Phrases like "Gap fill towards $[Price]", "Potential for $[Price]", or "Letting it ride to $[Price]" are tradeable signals.
        - DIRECTION: If the target is LOWER than current mention price or mentions "downside", it is BEARISH (SELL). If higher or mentions "upside", it is BULLISH (BUY).
        - Example: "Fill the gap, then let's talk. $MSFT" (Assuming gap is below) -> action: "SELL"
        - Example: "$META $730. letting it ride to $751 gap fill" -> action: "BUY"

        NEGATIVE MOMENTUM & SHORT CALLS (BEARISH):
        - Phrases like "Not good...", "What a drop", "Calling out shorts", "Technical breakdown", "-X% from peak", "just turned red", "blow off top", or "tough trade" are BEARISH (SELL).
        - SEASONALITY: Historical negative performance claims like "Worst month", "Tough month", or "Historically red" for an asset are BEARISH (SELL).
        - SECTOR WEAKNESS: Listing many negative sector returns for an index (e.g., "$SPX performance by sector: Tech -0.58%, Health -1.20%...") is BEARISH (SELL).
        - Example: "February has historically been a tough trade. Second-worst month for $SPX." -> action: "SELL"
        - Example: "$SNDK just turned red. Blow off top dance." -> action: "SELL"
        - Example: "$APP $482’s today. Wow what a drop. I do call out shorts too!" -> action: "SELL"
        - Example: "$BMNR -85% from ATH’s. Not good…" -> action: "SELL"
         `;

        const { object } = await generateObject({
            model: google('gemini-2.0-flash'),
            schema: CallSchema,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: promptText },
                    ...(imageUrl ? [{ type: 'image', image: imageUrl }] : [])
                ]
            } as any],
        });

        if (object.action === 'NULL') return null;

        return object;
    } catch (error: any) {
        console.error('[AI-Extractor] Error:', error);
        throw error;
    }
}
