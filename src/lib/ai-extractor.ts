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

        GURU RHETORIC & TECHNICAL SIGNALS (BULLISH):
        - Phrases like "Calm before the storm", "The worst is over", "Bottom is in", "Ready for takeoff/breakout", "Looks like a bottom", "Consolidation before expansion", "on fire", "Catch the bottom", "Shakeout", "shakeout", "Dip is for buying", "most hated rally", "You just need [Amount] [Symbol]", "still not selling", "not selling", "not stopping", "Key pivot is approaching", "another key pivot is approaching", "psychopath if you're still in", "only psychopaths are still holding", "Perfect rotation", "Diamond hands", "Diamond Hands", "give me one more spike lower", "Bullish Aster", "Bullish WLFI", "Is this exciting for you guys?", or mentioning **CHART PATTERNS** like "Cup and handle", "Bull flag", "Flagging", "Cup", "Base forming", "stuck in a wedge", "falling wedge", or "ascending triangle" are BULLISH (BUY).
        - **CONTRARIAN INDICATORS**: Mentions of contrarian signals like "When Peter Schiff is doing victory laps you probably should be buying", "Inverse Cramer", "Blood in the streets", or "Everyone is panic selling" are BULLISH (BUY).
        - **TECHNICAL TARGETS**: Phrases like "Gap fill at [Higher Price] is inevitable", "Next stop [Higher Price]", "Targeting [Higher Price]", or "[Resistance] obliterated" are BULLISH (BUY).
        - **TECH INDICATOR FLIP**: Mentioning an indicator flipping to a positive state (e.g. "Momentum flipped to blue", "MACD cross", "RSI divergence") is BULLISH (BUY).
        - **BREAKOUT WATCH**: Phrases like "Watching for the breakout", "Don't miss out!", "Ready to pop", or "About to squeeze" are BULLISH (BUY).
        - **INDICATOR-BASED EXIT**: If the author is waiting for a specific indicator or sell signal to appear at a higher price (e.g. "When the red dots come, I will dump", "Waiting for Lux sell signal"), it implies they are BULLISH (BUY) until that signal triggers.
        - **ROTATION & CAPITAL FLOW**: Phrases like "Rotation into $[Symbol]", "Capital flight from [Other Asset] to $[Symbol]", "Institutional inflow", or simply "$[Symbol] vs [Other Asset]. Rotation." are BULLISH (BUY).
        - **BEAR PAIN**: Phrases indicating the suffering of those betting against the asset, such as "Bear Despair", "Bear Tears", "Bear Pain", "Bears getting cooked/fried", or "Bear trap" are BULLISH (BUY).
        - **SARCASTIC MOCKERY**: Mocking "bears" or "fudsters" by quoting a ridiculous low price target from a fictional or silly source (e.g. "But someone told me $BTC is going to $4k 😂", "Wait, isn't it going to zero?") is BULLISH (BUY).
        - **HISTORICAL ANALOGY**: Pointing to a past event where a crash led to a massive pump (e.g. "Last time we crashed 30% we then pumped 100%", "Yen intervention crash followed by moon") implies a bullish outcome is coming.
        - Example: "$MSTR ... When Peter Schiff is doing victory laps you probably should be buying." -> action: "BUY" (Contrarian indicator)
        - Example: "$SOL Catch the bottom. Trends don't die in a day." -> action: "BUY"
        - Example: "$AAPL resistance at $245 about to be obliterated." -> action: "BUY" (Technical breakout)
        - Example: "$SOFI stuck in a wedge. watching for breakout. Don't miss out!" -> action: "BUY"
        - Example: "$BTC 🟠 When the red dots come, I will dump." -> action: "BUY" (Bullish until exit signal)
        - Example: "$ZEC will have the most hated rally." -> action: "BUY"
        - Example: "You just need 1000 $ZEC in your wallet." -> action: "BUY"
        - Example: "If you're still in $ZEC you are truly a psychopath." -> action: "BUY" (Hated rally sentiment)
        - Example: "Finally. The perfect rotation into $ETH." -> action: "BUY"
        - Example: "What's in your cup? $APLD" -> action: "BUY" (Chart pattern)
        - Example: "Calm before the storm. $LAC" -> action: "BUY" (Technicals bullish)
        - Example: "$BABA. The worst is over here. Finally." -> action: "BUY"
        - Example: "$AAPL $259. Held up well today despite QQQ down almost 2%." -> action: "BUY"

        GAP FILLS & TARGETS:
        - Phrases like "Gap fill towards $[Price]", "Potential for $[Price]", or "Letting it ride to $[Price]" are tradeable signals.
        - DIRECTION: If the target is LOWER than current mention price or mentions "downside", it is BEARISH (SELL). If higher or mentions "upside", it is BULLISH (BUY).
        - Example: "Fill the gap, then let's talk. $MSFT" (Assuming gap is below) -> action: "SELL"
        - Example: "$META $730. letting it ride to $751 gap fill" -> action: "BUY"

        EXHAUSTION SIGNALS (BEARISH - HIGHEST PRIORITY):
        - Phrases like "buyers will run out", "exhaustion", "running out of steam", or "no more bid" on a rallying asset are BEARISH (SELL).
        - DESCRIPTIVE BUYING + SKEPTICISM: If the author describes strong buying (e.g. "scooping", "big bid") but ends with skepticism like "At some point...?!", "Eventually...", or "Can't last forever", you MUST interpret this as BEARISH (SELL). The skepticism AFTER the description is the true signal.
        - Example: "They keep scooping the dip... eventually?! $SPX" -> action: "SELL"

        RELATIVE OVERVALUATION (BEARISH):
        - Comparing an asset to its peers as "the most expensive", "overvalued", or noting it's at "ATHs while others are flat/down" is a BEARISH (SELL) signal or reversal warning.
        - Example: "$GOOG is the only one at ATHs while the rest are off. Most expensive Mag 7." -> action: "SELL"

        PROFIT TAKING (BEARISH - SELL):
        - Phrases like "ring the register", "take profits", "booking gains", or "no one ever went broke taking a profit" are BEARISH (SELL) signals.
        - Example: "$META $730... if you ring the register and take profits, I do not blame ya." -> action: "SELL"

        NEGATIVE MOMENTUM & SHORT CALLS (BEARISH):
        - Phrases like "Not good...", "What a drop", "Calling out shorts", "Technical breakdown", "-X% from peak", "just turned red", "blow off top", "tough trade", "Not having a good time", "Down bad", "being dumped like a shitcoin", "topped out", "slow grind down", "stay out", "avoid at all costs", "retrace", "full pump retrace", "annoying", "doesn't help", "Yikes", "yikes", "I don't see how it holds", "suck the life out of you", "rolled over", "Moon boys are very quiet", "moon boys are quiet", "Bear cycle started", "counter trading the trend", "I'm still short", "I am still short", "having the last laugh", "proved me right once again", "structure stays broken", "trending down", "avoid catching falling knives", "Wait for the real drop", "Searching for a bottom", "Hasn't bottomed yet", "bulls last chance", "fun while it lasted", "expect [Symbol] to retest", "Sold it all", "sold everything", "flush down to", "Bearish Aster", "inverted $[Symbol] chart", "dump it on all of our heads", "massively push $[Symbol] at the top and dump it", "market cycles", "lost its bullish trend line", "year of the [Symbol] Bear Market", "Bear Market signals have flashed", "[Symbol] is ~[Percentage]% of the way through its current Bear Market", "Bull Market EMAs have officially crossed over", "Bearish Marubozu", "Bearish wedge", "caution", or "You have no idea how hard people are going to cry when [Symbol] is at [Lower Price]" are BEARISH (SELL).
        - **NEGATIVE PUMP DESIRE**: Phrases like "Never let $[Symbol] pump again", "Stop the pump", or "I hope this dumps" are BEARISH (SELL).
        - **SARCASTIC MOCKERY**: Mocking "bulls" or "moon boys" by quoting a ridiculous high price target from a fictional or silly source (e.g. "According to Twitter $LTC is heading straight to $8,000", "Someone said $BTC to 1M by Friday") is BEARISH (SELL).
        - **HISTORICAL ANALOGY**: Pointing to a past "bear market" chart or fractal as a guide for current price action is BEARISH (SELL).
        - WAITING FOR LOWER: Phrases like "Waiting for [Lower Price] and I am all in", "Hit [Lower Price] then I buy", or "Looking for [Lower Price] to enter" are BEARISH (SELL) for the short-term direction. 
        - SKEPTICAL REBOUNDS: Even if the author denies an extreme crash (e.g. "I don't think we hit $30k"), if the level mentioned is significantly below current price and the tone is cautious, it is BEARISH (SELL).
        - Example: "$CHZ Yikes." -> action: "SELL"
        - Example: "$BTC rolled over... should have known." -> action: "SELL"
        - Example: "Moon boys are quiet today... clown market." -> action: "SELL"
        - Example: "$BTC ... I'm still short." -> action: "SELL"
        - Example: "$BTC ... can suck the life out of you if you are wrong." -> action: "SELL"
        - Example: "$BTC ... structure stays broken and trending down." -> action: "SELL"
        - Example: "$TSLA Well, it was fun while it lasted." -> action: "SELL"
        - Example: "Sold it all and took the gain from today. $TSLA" -> action: "SELL"
        - Example: "This is an inverted $BTC chart... looks bullish." -> action: "SELL" (Actual chart is bearish)
        - Example: "Tether has $XAUT now... If @circle does not do the same, it means $CRCL stock is not a good investment" -> ticker: "CRCL", action: "SELL"
        - Example: "looks like 2026 is shaping up to be the year of the Bitcoin Bear Market" -> action: "SELL"
        - Example: "10 out of 12 confirmed signals have indeed flashed... ~80% of the Bear Market signals have flashed" -> action: "SELL"
        - Example: "Bitcoin is ~25% of the way through its current Bear Market" -> action: "SELL"
        - Example: "The Bitcoin Bull Market EMAs have officially crossed over" (context: bearish breakdown) -> action: "SELL"
        - Example: "$BTC ... lost its bullish trend line." -> action: "SELL" (Trend loss)
        - Example: "$NVDA ... I don't see how it holds here." -> action: "SELL"
        - Example: "Promise me you'll never let $ZEC pump again" -> action: "SELL"
        - Example: "According to Twitter $LTC is heading straight to $8,000" -> action: "SELL" (Sarcastic mockery of moon sentiment)
        - Example: "$ZEN ...annnnd full pump retrace." -> action: "SELL"
        - Example: "$ZEN ... annoying. BTC dropping at the same time probably doesn't help." -> action: "SELL"
        - Example: "$ETH Bearish Marubozu" -> action: "SELL"
        - Example: "This started looking more and more like a bearish wedge. Caution. $BTCUSD" -> action: "SELL"
        - Example: "Bearish Aster" -> action: "SELL"
        - Example: "give me one more spike lower... $ZEC" -> action: "BUY" (Demand for entry)
        - Example: "Bullish Aster" -> action: "BUY"
        - Example: "Bullish WLFI" -> action: "BUY"
        - Example: "$USO Is this exciting for you guys?" -> action: "BUY" (Context: Breakout)
        `;

        const models = ['gemini-2.0-flash-001', 'gemini-1.5-flash', 'gemini-1.5-pro'];

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

        let lastErr;
        for (const model of models) {
            try {
                const { object } = await generate(model);
                if (object.action === 'NULL') return null;
                return object;
            } catch (err: any) {
                lastErr = err;
                const isQuota = err.message?.includes('Quota') || err.message?.includes('429');
                if (isQuota) {
                    console.warn(`[AI-Extractor] Quota hit for ${model}, trying next...`);
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }
                throw err;
            }
        }

        throw lastErr;
    } catch (error: any) {
        if (error.message?.includes('Quota') || error.message?.includes('429')) {
            throw new Error('Our AI models are currently at capacity. Please try again in a few minutes.');
        }
        console.error('[AI-Extractor] Fatal:', error);
        throw new Error('Failed to analyze tweet. The AI service is currently unavailable.');
    }
}
