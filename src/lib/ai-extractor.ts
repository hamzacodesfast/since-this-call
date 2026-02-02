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
        // 0. Pre-filter Noise (Deterministic)
        const upperText = tweetText.toUpperCase();
        const NOISE_PHRASES = [
            'LIVE SHOW', 'LIVE NOW', 'JOIN US', 'STREAMING NOW', 'TWITTER SPACE', 'BREAKING NEWS',
            'TRADE OF THE WEEK', 'WEEKLY RECAP'
        ];

        // Only blocking if there isn't a clear "I AM BUYING" signal to be safe? 
        // No, aggressive filtering is better for noise reduction as per user request.
        // But we want to avoid blocking real trades. 
        // Let's block "LIVE SHOW" definitely.
        if (NOISE_PHRASES.some(phrase => upperText.includes(phrase))) {
            console.log('[AI-Extractor] Blocked by Noise Filter:', tweetText.substring(0, 50));
            return null;
        }

        const btcPrice = marketContext?.['BTC'] || 90000;

        const promptText = `
        ROLE:
        You are a financial analyst extracting signals for professional investors. 
        We ONLY track major assets found on Yahoo Finance, CoinMarketCap, or CoinGecko.
        - INDEX SYMBOLS: Symbols like $SPX, $ES, $NDX, $NQ, $DJI, and $RUT are MAJOR ASSETS and MUST be tracked (they map to ^GSPC, ES=F, ^NDX, NQ=F, ^DJI, ^RUT).

        CRITICAL DIRECTIVE:
        If the tweet is about a MEME COIN, a PUMP.FUN token, or a low-cap DEX-only token (e.g. anything not in the top 500 by market cap or listed on major centralized exchanges), you MUST return action: "NULL".
        We do NOT track "moonshots", "shilling", or any unlisted "gems". 
        
        WORD TICKERS ($HYPE, $DEGEN, etc):
        Some tickers look like common words (e.g. $HYPE, $DEGEN, $MOG, $BRETT).
        You MUST treat these as valid assets IF and ONLY IF:
        1. They are prefixed with a '$' (e.g. $HYPE).
        2. The context is strictly financial (price action, chart, "outperformance", "strength", "long", "short").
        - Example: "$HYPE outperforming everything." -> ticker: "HYPE", action: "BUY"
        - Example: "This is pure hype." -> action: "NULL" (Common word usage)

        Tweet Content: "${tweetText}"
        Tweet Date: "${tweetDate}"
        
        DIRECTIVES:
        1. Action: BUY (Active Long/Spot position), SELL (Active Short position), NULL (No trade, factual reporting, conditional, or meme coin).
        2. Ticker: Return pure symbol (e.g. BTC, HYPE, MSTR).
        3. Sentiment Analysis: Handle sarcasm, memes, and slang as signals for MAJOR assets only.
        4. If it is a meme coin like $WIF, $BONK, $PEPE, or any other "fun" token, use NULL unless you are certain it is a major market leader found on major centralized exchanges (though leaning towards NULL is safer if in doubt).

        NEGATIVE CONSTRAINTS (CRITICAL - RETURN action: "NULL"):
        1. LIVE SHOWS / NEWS: If the tweet contains "LIVE SHOW", "LIVE NOW", "JOIN US", "STREAMING", "Twitter Space", or "Breaking News", you MUST return NULL unless there is an EXPLICIT "I am buying [Ticker]" statement. Discussions about macro events (e.g. "Yen Intervention") are NEWS, not calls.
        2. FACT STATING / DATA ONLY: If the tweet only reports data (e.g., "Volume is huge", "RSI is oversold", "Open Interest is rising") without the author explicitly stating they are BUYING or SELLING, you MUST return NULL. DO NOT infer direction from volume or indicators.
        3. AMBIGUOUS / TWO-SIDED: If the author says "Could go both ways", "Waiting for a break", or "Up or down", return NULL.
        4. CONDITIONAL / IF-THEN: "Buying if [level] breaks" or "Selling if [event] happens" MUST return NULL. We only track active positions or immediate calls.
        5. VAGUE BULLISHNESS: "This looks interesting", "Eyes on this", or "Watching this" without a definitive "Long" or "Buy" signal MUST return NULL.
        6. LACK OF CONTEXT: If the tweet is just a ticker symbol and a chart without any text indicating an active trade, return NULL.

        EXAMPLES OF NULL SIGNALS:
        - "JOIN US LIVE! Discussing $BTC." -> action: "NULL" (Live Show)
        - "LIVE SHOW: 1) $META soars 2) $BTC crash" -> action: "NULL" (Show Agenda / Topics)
        - "Breaking: $ETH ETF approved." -> action: "NULL" (News Fact)
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

        - **NEGATIVE MOMENTUM & SHORT CALLS (BEARISH)**:
        - **SWEEPING LOWS (BEARISH)**: Phrases like "sweep some lows", "sweep the lows", or "liquidity sweep below" imply the price must move down to hit those levels and are BEARISH (SELL).
        - **BREAKDOWN WARNINGS (BEARISH)**: Phrases like "line in the sand", "lose this level and it opens the door for much deeper", "if we lose [Level] it's lights out", or "must hold [Level] or else" are BEARISH (SELL) when the author is highlighting the downside risk.
        - **LOWER ENTRY TARGETS (BEARISH)**: If an author wants to "accumulate" or "buy the dip" at a price significantly lower (e.g. 20-30% below) current levels, it is BEARISH (SELL) for the short-term direction.
        - **OI ABSORPTION (BEARISH)**: "Price barely moved + Open Interest skyrocketing" or "Price didn't move much and OI increased rapidly" suggests aggressive short accumulation or an impending breakdown and is BEARISH (SELL).
        - **ZOOM OUT DISTRESS (BEARISH)**: Phrases like "Just zoomed out and [Negative Action/distress]" or "The monthly/weekly chart is a nightmare" are BEARISH (SELL).
        - Phrases like "Not good...", "What a drop", "Calling out shorts", "Technical breakdown", "-X% from peak", "just turned red", "blow off top", "tough trade", "Not having a good time", "Down bad", "being dumped like a shitcoin", "topped out", "slow grind down", "stay out", "avoid at all costs", "retrace", "full pump retrace", "annoying", "doesn't help", "Yikes", "yikes", "I don't see how it holds", "suck the life out of you", "rolled over", "Moon boys are very quiet", "moon boys are quiet", "Bear cycle started", "counter trading the trend", "I'm still short", "I am still short", "leaning bearish", "bearish bias", "bearish tilt", "staying short", "having the last laugh", "proved me right once again", "structure stays broken", "trending down", "avoid catching falling knives", "Wait for the real drop", "Searching for a bottom", "Hasn't bottomed yet", "expect [Symbol] to retest", "Sold it all", "sold everything", "flush down to", "Bearish Aster", "inverted $[Symbol] chart", "dump it on all of our heads", "massively push $[Symbol] at the top and dump it", "market cycles", "lost its bullish trend line", "year of the [Symbol] Bear Market", "Bear Market signals have flashed", "[Symbol] is ~[Percentage]% of the way through its current Bear Market", "Bull Market EMAs have officially crossed over", "Bearish Marubozu", "Bearish wedge", "caution", or "You have no idea how hard people are going to cry when [Symbol] is at [Lower Price]" are BEARISH (SELL).
        - **FUTURE BOTTOMS (BEARISH)**: If the author predicts the price will "bottom in [Future Month/Quarter]" (e.g. "BTC to bottom in Oct"), it implies more downside is expected before then. This is BEARISH (SELL).
        - **SARCASTIC MOCKERY (BEARISH)**: Mocking "bulls" or "moon boys" for holding through dumps (e.g. "If you can't handle -70% dumps you don't deserve 5% pumps", "Poor bulls", "Hope the moon boys are enjoying the air down here") is BEARISH (SELL).
        
        - **GURU RHETORIC & TECHNICAL SIGNALS (BULLISH)**:
        - **OI DIVERGENCE (BULLISH)**: "Price down + Open interest up" or "OI moving up while price moving down" is a squeeze signal and is BULLISH (BUY).
        - **DOUBLE NEGATIVES**: Phrases like "does NOT NOT mean go long" mean "definitely go long" or "it is time to go long" and are BULLISH (BUY).
        - **TECHNICAL TARGETS MET**: Stating that a bearish pattern (like Head and Shoulders) has "met its target" often signals the end of the move and is BULLISH (BUY) if combined with a reversal bias.
        - Mentioning **BMNR** (Bitmanir) as a major asset related to Bitcoin miners/staked yield is allowed.
        - Projections of increased NAV per share or staked yield value (e.g. "yield will be worth $0.49 per share") are BULLISH (BUY).
        - Phrases like "Calm before the storm", "The worst is over", "Bottom is in", "Ready for takeoff/breakout", "Looks like a bottom", "Consolidation before expansion", "on fire" ... 
        - Example: "$BTC ... Should follow soon to sweep some lows across the board." -> action: "SELL"
        - Example: "If we lose $84k on the Daily close... opens the door for a much deeper move." -> action: "SELL"
        - Example: "accumulating ETH on dips, ideally all the way down into the $1900–$2000 zone" -> action: "SELL" (Short-term downside target)
        - Example: "$BTC Just zoomed out and [Negative event]." -> action: "SELL"
        - Example: "$BTC OI skyrocketing when price has barely moved." -> action: "SELL"
        - Example: "$BTC price moving down. Open interest moving up. Ends only one way." -> action: "BUY"
        - Example: "$AAPL H&S target met. Does NOT NOT mean go long." -> action: "BUY"
        - Example: "BTC to bottom in Oct then straight up." -> action: "SELL" (Implied downside first)
        - Example: "$BMNR ... staked yield will be worth $215 million ($0.49 per share)." -> action: "BUY"
        - Example: "If you can't handle -70% dumps you don't deserve 5% pumps $CRV" -> action: "SELL"
        - Example: "Looking for longs around 87k" (Current price 95k) -> action: "SELL" (Targeting lower)
        - Example: "Why I am leaning bearish" -> action: "SELL"
        - **GURU CONVICTION**: Phrases indicating extreme personal investment or conviction such as "I'm betting it all", "Betting the farm", "NW invested", "100% of my NW", "I will go bankrupt if...", "You are not bullish enough", "No one is more bullish", "Submit my ticket to the [Amount] club", "I am buying every dip", "You already know I am [buying/long]", "Don't say I didn't warn you", "generational opportunity", "generational wealth", or "free money" are BULLISH (BUY).
        - **ASSET ANALOGIES**: Comparing an asset to a legendary success story (e.g. "The next Palantir", "$[Symbol] is the next $[Major Symbol]", "The $[Symbol] of $[Asset Class]") is BULLISH (BUY).
        - Example: "If a black swan hits $IREN I go bankrupt. Betting it all." -> action: "BUY"
        - Example: "$IREN is the next Palantir. Buy every dip." -> action: "BUY"
        - Example: "You are not bullish enough $IREN" -> action: "BUY"
        - Example: "No one is more bullish on $IREN than me." -> action: "BUY"
        - Example: "Is this exciting for you guys?" -> action: "BUY" (Context: Breakout)
        `;

        const models = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-pro-latest'];
        let lastErr;

        // Simple delay helper
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
            // Try up to 2 times per model
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const { object } = await generate(model);
                    if (object.action === 'NULL') {
                        console.log(`[AI-Extractor] ${model} returned NULL (Call Action is NULL)`);
                        return null;
                    }
                    return object;
                } catch (err: any) {
                    lastErr = err;
                    const isQuota = err.message?.includes('Quota') || err.message?.includes('429') || err.message?.includes('403') || err.message?.includes('RESOURCE_EXHAUSTED');

                    if (isQuota) {
                        const waitTime = (attempt + 1) * 2000; // 2s, 4s...
                        console.warn(`[AI-Extractor] Quota hit for ${model} (Attempt ${attempt + 1}), waiting ${waitTime}ms...`);
                        await delay(waitTime);
                        continue; // Retry same model
                    }

                    // If not quota (e.g. strict safety filter), move to next model immediately
                    console.warn(`[AI-Extractor] Model ${model} failed: ${err.message}. Trying next...`);
                    break;
                }
            }
        }

        // If all fail, throw specific error
        if (lastErr && (lastErr.message?.includes('Quota') || lastErr.message?.includes('429'))) {
            throw new Error('Our AI models are currently at capacity. Please try again in a few minutes.');
        }

        throw lastErr || new Error('Failed to analyze tweet.');
    } catch (error: any) {
        console.error('[AI-Extractor] Fatal:', error);
        if (error.message?.includes('Quota') || error.message?.includes('429')) {
            throw new Error('Our AI models are currently at capacity. Please try again in a few minutes.');
        }
        throw new Error('Failed to analyze tweet. The AI service is currently unavailable.');
    }
}
