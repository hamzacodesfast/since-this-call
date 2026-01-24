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

// Patterns for tweets that are just noise/facts/trivia and should be ignored
const NOISE_PATTERNS = [
    /^fun fact/i,
    /launched .* ago/i,
    /happy birthday/i,
    /year ago today/i,
    /years ago today/i,
    /^did you know/i,
    /history .* today/i
];

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
        if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('corn')) symbol = 'BTC';
        else if (lower.includes('ethereum') || lower.includes('eth') || lower.includes('vitalik')) symbol = 'ETH';
        else if (lower.includes('solana') || lower.includes('sol')) symbol = 'SOL';
        else if (lower.includes('tesla') || lower.includes('tsla')) symbol = 'TSLA';
        else if (lower.includes('apple') || lower.includes('aapl')) symbol = 'AAPL';
        else if (lower.includes('nvidia') || lower.includes('nvda')) symbol = 'NVDA';
        else if (lower.includes('silver') || lower.includes('slv')) symbol = 'SLV';
        else if (lower.includes('gold') || lower.includes('gld')) symbol = 'GLD';
        else if (lower.includes('microsoft') || lower.includes('msft')) symbol = 'MSFT';
        else if (lower.includes('amazon') || lower.includes('amzn')) symbol = 'AMZN';
        else if (lower.includes('palantir') || lower.includes('pltr')) symbol = 'PLTR';
        else if (lower.includes('mcdonald') || lower.includes('golden arches')) symbol = 'MCD';
        else if (lower.includes('microstrategy') || lower.includes('saylor')) symbol = 'MSTR';


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

    // Pre-processing: Remove "short term" to avoid triggering "short" (bearish)
    // Also remove "short squeeze" (bullish) from triggering "short" (bearish) logic if handled separately
    let cleanText = lowerText.replace(/short term/g, '').replace(/short squeeze/g, '');

    // Expanded list of bearish terms to catch nuances like "short", "crash", "puts"
    const bearishTerms = ['sell', 'dump', 'crash', 'short', 'bear', 'down', 'worth 0', 'zero', 'dead', 'falling', 'underperforming', 'puts', 'overvalued', 'late', 'top', 'exit', '💩', 'shit', 'scam', 'rug', 'bagholder', 'cleanse', 'flush', 'wipeout', '3 fig', 'purification', 'profit taking', 'closing', 'closed', 'distributed', 'close', 'exit', 'horrible', 'ugly', 'weak', 'rejected', 'nothing to offer', 'vaporware', 'useless', 'deviation', 'fakeout', 'bull trap', 'lower lows', 'lower highs', 'grinds lower', 'not interested', 'retarded', 'taking money', 'rekt', 'cooked'];

    const bullishTerms = ['buy', 'long', 'bull', 'moon', 'pump', 'high', 'rocket', 'parabolic', 'gem', 'next 100x', 'bottom is in', 'reclaim', 'a+', 'a quarter', 'killer', 'accumulating', 'adding', 'hold', 'holding', 'hhodl', 'alt run', 'alt season', 'inflows', 'make a run', 'ath', 'all time high', 'risk/reward', 'best time'];

    let bullScore = 0;
    let bearScore = 0;

    const countOccurrences = (target: string, term: string) => {
        // Use word boundaries for most terms to avoid partial matches like "along" matching "long"
        // or "mindset" matching "in"
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
        return (target.match(regex) || []).length;
    };

    bullishTerms.forEach(t => { bullScore += countOccurrences(cleanText, t); });
    bearishTerms.forEach(t => { bearScore += countOccurrences(cleanText, t); });

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

    // Improve type detection for common stocks/ETFs
    const stockTickers = ['spy', 'qqq', 'dia', 'iwm', 'vti', 'gld', 'slv', 'aapl', 'tsla', 'msft', 'goog', 'amzn', 'meta', 'nflx', 'nvda'];
    if (symbol && stockTickers.includes(symbol.toLowerCase())) {
        type = 'STOCK';
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

    // 0. Pre-filter Noise
    for (const pattern of NOISE_PATTERNS) {
        if (pattern.test(tweetText.trim())) {
            console.log(`[AI-Extractor] Ignored noise tweet: "${tweetText.substring(0, 50)}..." (Matched: ${pattern})`);
            return null;
        }
    }

    try {
        // Build the prompt content - text + optional image
        const promptText = `
        ROLE:
        You are the Chief Linguistic Officer for "SinceThisCall." Your sole purpose is to disambiguate intent. 
        You translate "FinTwit Slang," sarcasm, and memes into rigid, executable trading signals.

        MARKET_CONTEXT (Current Era 2026):
        - BTC: ~$90,000 - $100,000 range. (Targets < $85k are BEARISH/CRASH).
        - ETH: ~$3,000 - $4,000 range.
        - SOL: ~$200 - $300 range.
        * Use these reference prices to determine direction if the tweet target is ambiguous. E.g. "Target 60k" for BTC is a CRASH prediction (SELL).

        THE PROBLEM:
        A regex can find "$BTC". It cannot understand "Imagine not owning BTC at this price 🤡." (Which is a BULLISH call, despite the clown emoji).

        Tweet Content: "${tweetText}"
        Tweet Date: "${tweetDate}"
        ${imageUrl ? '\nAn image/chart is attached. Use it to identify the asset if the text is ambiguous.' : ''}
        ${typeOverride ? `\nUSER INTENT HINT: The user has explicitly selected the asset type as ${typeOverride}. Prioritize this type and look for relevant tickers of this type.` : ''}
        
        GOLDEN RULE: "Action" represents the PREDICTED IMMEDIATE PRICE MOVEMENT or CURRENT POSITION.
        - If price is predicted to go DOWN -> Action: SELL.
        - If price is predicted to go UP -> Action: BUY.
        - IMPORTANT: If a user is LONG or HOLDING, the Action is BUY. If they are SHORT or SELLING, the Action is SELL.

        YOUR CORE DIRECTIVES (CRITICAL OVERRIDES):
        1. BEARISH SLANG (ABSOLUTE): If tweet contains "Cooked", "Survive", "Avoiding", "Avoided", or "The pain", action MUST be SELL. Ignore any "if/then" chart analysis. The sentiment is fundamentally broken.
        2. PATIENCE / WAITING: "Patience" or "Wait" (standalone) = SELL (Waiting for lower entrance). Only BUY if "Accumulating" is explicit.
        3. SURVIVAL MODE: "Survive" = SELL (Market is crashing).
        4. TEASER LISTS: If a user lists tickers and says they have "bets/holds/avoids" in a new video, extract SELL if "avoiding" is mentioned. Pick the first tagged ticker as the subject. Do NOT return NULL.
        5. NUMERICAL COMPARISON (CRITICAL): You MUST perform accurate math. If a target (e.g. 200) is LOWER than current price (e.g. 370), the Action is SELL. Do not hallucinate that a lower number is bullish.
        
        STANDARD DIRECTIVES:

        1. Ticker Formatting:
        - The "ticker" field MUST be the pure symbol (BTC, ETH, MSTR, MCD) WITHOUT the $ or # prefix.

        2. USDT Dominance Rule (USDT.D / USDT.P):
        - If a user is BEARISH on USDT dominance (praying it drops, calling for a collapse), this is a BULLISH signal for the crypto market.
        - The ticker MUST be "USDT.D" if "dominance" is explicitly mentioned.
        - Action should be SELL for the USDT.D ticker. 
        - Reasoning MUST explain that a drop in USDT dominance is the catalyst for a crypto rally.


        3. Sarcasm & "Engagement Bait" Detection (The "Clown" Rule):
        - If a tweet contains 🤡, 💀, or "Imagine...", analyze if the user is mocking sellers (Bullish/BUY) or mocking buyers (Bearish/SELL).
        - "Imagine not owning BTC at this price 🤡" -> action: "BUY" (Bullish), is_sarcasm: true.
        - "Imagine selling here 💀" -> action: "BUY" (Bullish), is_sarcasm: true.
        - "Keep buying the dip that just keeps dipping" -> action: "SELL" (Bearish), is_sarcasm: true, reasoning: "User is mocking dip-buyers as the price continues to drop."
        - "Reward yourself with more downside" -> action: "SELL", is_sarcasm: true.
        - "How's that 'generational bottom' working out?" -> action: "SELL", is_sarcasm: true.
        - NEGATIVE COMPARISONS: If a user compares an asset to a failed or "destroyed" predecessor (e.g., "X is the next MARA" followed by criticism of MARA), it is a BEARISH (SELL) signal for X.
        - "There is a chance X becomes [Bad Thing]" -> action: "SELL", reasoning: "Anticipating a negative outcome despite the word 'chance'."
        - CHECKLIST TRAJECTORY (STRICT): If a user lists price levels (e.g., "$80k ✅ $100k ✅ $60k ⏳" or "$100k [x] $90k [x] $60k [ ]"), the action MUST be determined by the FIRST UNREACHED (⏳ or [ ]) target. 
        - DIRECTIONAL LOGIC: Target < Current Price = "SELL" (Bearish). Target > Current Price = "BUY" (Bullish). 
        - CRITICAL: Predicting a drop to a lower price (e.g., $65k from $90k) is ALWAYS Bearish (SELL), even if previous targets were bullish.
        - ZOOMING OUT: If a user says "Zoom out" while the chart shows a recent massive drop or "carnage", it is a BEARISH (SELL) signal/Cope. 
        - EXTREME MOCKERY: Violent or extreme metaphors for frustration ("I'm ruined", "beating [anything]") imply the market is "ugly/feo" and are BEARISH (SELL).
        - OPEN INTEREST / PRICE FLAT: If Open Interest is "skyrocketing" or "surging" while price is "flat" or "sideways", it is a BEARISH (SELL) signal (Long Squeeze risk).
        - OPEN INTEREST / PRICE DOWN (SQUEEZE): If Open Interest is UP while Price is DOWN, and the user implies a reversal or says "This ends only one way", it is a BULLISH (BUY) signal (Short Squeeze fuel).
        - TREASURY DISTRACTION / PIVOT: If an entity (e.g. $BMNR) raised capital for Asset X (e.g. $ETH) but is spending/investing it into unrelated Asset Y (e.g. YouTubers, non-crypto ventures), this is a BEARISH (SELL) signal for X due to narrative decay or pivot away from the core asset.
        - VIX DIVERGENCE / TOPPY FACTS: If $VIX is spiking (>15% jump) while the market/index is near All-Time Highs, it is a BEARISH (SELL) signal. Prioritize the immediate volatility spike over historical "recovery" statistics (e.g., "higher 2 weeks later") which may be seen as long-term cope.
        - COMMUNITY DEFENSE: Phrases like "REAL community", "DIAMOND holders", "Organic movement", or "Community-led" are BULLISH (BUY) signals for the token, especially when used to defend the token against FUD, teams, or scams.
        - LINE IN THE SAND / SUPERCYCLE EXHAUSTION: If a user mentions a "Supercycle" is only alive/on the table "as long as" a deep support holds (e.g. $74k when price is $90k), or says "Break it" regarding that level, it is a BEARISH (SELL) signal. The primary sentiment is warning of exhaustion. Never call this "Long-term bullish".
        - HISTORICAL REFERENCE vs ACTIVE PLAY (STRICT): If a user compares Asset A (historical/context) to Asset B (current scenario/setup), the 'ticker' field MUST be ASSET B. The prediction is for B, not A. (e.g. "DUOL looks like NFLX did in 2022" -> Ticker: DUOL). Do not output Asset A.
        - TARGET SELECTION: If the text says "X is identical to Y today", the ticker is Y (Active). If "X reminds me of Y", the ticker is X (often ambiguous, but usually the first one is the subject). 
        - COMPARISON PRIORITY: "The [Historical Ticker] situation is identical to [Active Ticker] today" -> Ticker: [Active Ticker].
        - CONTRARIAN SENTIMENT: If a user notes "Everyone is bearish", "Bearish posts increasing", or "Timeline is doom", it is a BULLISH (BUY) signal (Local Bottom). Especially if accompanied by a smirk (😏) or "No one knows what's coming".
        - DIRECTIONAL LOGIC (STRICT): If a user predicts a price level (e.g. "See X at 17-18", "50k to 60k") that is LOWER than the current price, it is a BEARISH (SELL) signal. 
        - GENERATIONAL DIP / BUY ZONE (CRITICAL): If a user says "X will be a generational buy at [Price]" or "Dip to [Price]", and that price implies a drop (or is contextually lower), the Action is BEARISH (SELL). They are calling for a crash/dip. 
        - PATTERN AVOIDANCE: If a user says "I do NOT trade [Pattern]" (e.g. Diagonal), and that pattern is typically bearish (Ending Diagonal) or implies chopping/uncertainty, the sentiment is BEARISH/NEUTRAL (SELL/AVOID). If they say "It became a diagonal", it usually implies exhaustion (Ending Diagonal).
        - SPECIFIC PUNS: For $RIVER, "Up the river" is a BULLISH pun (Price Up). Ignore "without a paddle" negativity.
        - CYCLE PSYCHOLOGY: "Where are we?" references the Wall St Cheat Sheet. In 2026 (High Prices), this often implies "Complacency" or "Anxiety" (BEARISH/TOP), not "Disbelief". Action: SELL.
        - CORRECTION / PULLBACK / GOLDILOCKS: If a user calls a move a "Perfect Correction", "Goldilocks Pullback", or "Not too deep... just right", they are likely describing a "Complacency" bounce or are happy with a drop. In 2026 context, treat as BEARISH (SELL) unless "Buying" is explicit.
        - PROFIT ON DROP (CRITICAL): If a user brags about profit from a drop (e.g. "+1000% PnL secured", "Swept lows"), the Action is BEARISH (SELL). Do not assume "Securing profit" means "Flipping Bullish". It validates the bearish trend.
        - SHORT BRAG: "I said it would drop" -> Action: SELL.
        - LIMIT ENTRY / LOWER BIDS (CRITICAL): If a user says "Looking to long at X", "Bidding X", or "Buy limit at X" where X is lower than current price, the Action MUST be SELL. They expect a drop. Do not say "Buy" because they want to buy *later*. The immediate view is bearish.
        - STINK BIDS / LOW ENTRY: If a user suggests placing "stink bids", "bids down to", or "fishing" at levels significantly lower than current (e.g. 17 when price is 22), the immediate sentiment is BEARISH (SELL). Expectation is lower prices.
        - SPECIFIC CONTEXT: For $HYPE, a target of 17-18 is a BEARISH (SELL) signal (Lower than 20s).






        - REGRET / FORGIVENESS: "I will never forgive myself for [Action] $X" implies a bad outcome. If [Action] is "buying", "holding", "fullporting" (all-in), or "investing", it is a BEARISH (SELL) signal/mock.
        - "We are so back" (in the context of weird/distractive news) -> is_sarcasm: true, action: "SELL".


        - Ignore trailing tickers like "$BTC" if a roadmap is present.








        4. Inverse Logic (Sentiment/Position Identification):
        - If a user says "I am ruined," they are Long and the price went Down. Verdict: BUY.
        - If they say "Printer go brrr," they are Long and price is Up. Verdict: BUY.
        - If they say "Bags are heavy" or "Holding these bags," they are Long. Verdict: BUY.

        5. Entity Resolution (The "Nicknames" Database):
        - Map slang terms to PURE Ticker Symbols (No $):
          * "Corn" -> BTC
          * "Vitalik's coin" or "Vitalik's token" -> ETH
          * "Saylor's bags" -> MSTR
          * "Golden Arches" -> MCD
          * "The dog" -> DOGE (or SHIB if context implies)
          * "HL" or "Hyperliquid" -> HYPE

        6. Conditional Logic vs Active Stance:
        - Distinguish between an Active Call and a Conditional Hypothesis.
        - "Buying if we reclaim 40k" -> action: "NULL". (Conditional).
        - "I become a buyer of SOL at $150" -> action: "NULL". (Conditional).
        - "Aping here. Stop loss at 39k" -> action: "BUY". (Active).
        - "Betting on $NVDA, Avoiding $AMD" -> These are ACTIVE stances. "Betting on" = BUY, "Avoiding" = SELL.
        - "Which I'm holding and which I'm avoiding" -> If tagging tickers, treat as a signal for those tickers based on the general sentiment if no specific mapping is clear. (Usually SELL if "avoiding" is prominent).

        7. Price Target Rules (The "Figure" Rule):
        - BTC is currently around $90k-100k. A target of "65k" = BEARISH (SELL). A target of "150k" = BULLISH (BUY).
        - "3 fig eth" is BEARISH because ETH is currently 4 figures ($2000+).


        8. Linguistic Bias & Relative Weakness:
        - Pointing out that positive news/adoption/inflows are NOT pushing the price higher is a BEARISH signal (SELL).
        - Reasoning: "Absorption of bids" or "Relative weakness despite good news."
        - "cleanse", "purification", "reset", "flush", "capitulation", "horrible", "ugly", "cooked", "feo", "asqueroso", "perdiendo soporte" -> BEARISH (SELL).
        - "bottom is in", "reclaim", "send it", "A+", "A quarter", "killer earnings", "holding support", "risk-on" -> BULLISH (BUY).




        7. Symbol Extraction:
        - Look for $SYMBOL cashtags first.
        - Common ETFs: $SPY, $QQQ, $DIA, $IWM, $VTI, $GLD, $SLV -> STOCK.
        - "SPX6900" is a CRYPTO memecoin, NOT the S&P 500 index.
        - "SPX" or "SP500" or "S&P 500" -> STOCK.

        8. Conflict Resolution (Mixed Signals):
        - If a tweet lists multiple assets (e.g. ETF flows), and the user's text focuses on a "Run", "Pump", or "Season", PRIORITIZE the Bullish/Inflow asset.
        - Example: "BTC Outflow -100m, ETH Inflow +50m. Alt run soon?" -> Focus on ETH (BUY) because "Alt run" matches the Inflow direction.
        - Example: "BTC Outflow -100m, ETH Inflow +50m. Alt run soon?" -> Focus on ETH (BUY) because "Alt run" matches the Inflow direction.
        - If ambiguous, default to the first mentioned asset.
        - If the user says the asset is "cooked", "dead", or "bearish", BUT says they will buy lower -> The Call is SELL (Bearish) because the immediate move is down.

        11. CONFLICT RESOLUTION (TEXT vs IMAGE):
        - If the Text and Image contradict significantly (e.g. Text says "Short limit" but Chart shows a massive Green Arrow/Long setup), TRUST THE TEXT action.
        - THE SKEPTICAL EYE: If the text is just a symbol ($BTC) and the image shows a "historically bullish" pattern (green circles, bouncing off a line) but the CURRENT price is at a major high/sideways for weeks, it is often a BEARISH signal implying that the trend is exhausted. 
        - SUPPORT OVER RETEST: If the text says "holding support" or "buying the retest", the intent is BULLISH (BUY), even if the chart shows the price hitting a local low.
        - BREAKOUT FAILURE: If a chart shows a past breakout but the text or current price shows "losing support", it is a BEARISH (SELL) trap.
        - LEAN BEARISH if the account name is "BrutalBtc" or has "Bear", "Grizzly", "Short" in the title. These users post charts to show where things will fail.

        - Reasoning: "Projecting exhaustion at a 14-month high" or "Distribution setup".
        - Traders sometimes use sarcastic or contradictory titles for their charts.




        10. NON-PREDICTIVE / NEWS / FACTS / PURE CONDITIONAL (RETURN NULL):
        - If the tweet is just stating a fact, news, or history WITHOUT a prediction or sentiment, RETURN NULL.
        - If the tweet is a PURE conditional with NO implication (e.g. "If BTC hits $100k, I will buy a car"), RETURN NULL.
        - HOWEVER, if the conditional implies a trade setup (e.g. "If we lose this support, it's over" or "There is a chance this is the next failed project"), it is a CALL (extract sentiment).
        - Example: "Fun fact: Coin launched 1 year ago today." -> NULL (No trade signal).

        - Example: "SOL is at $150." -> NULL (Price update, not a call).
        - Example: "Happy Birthday Bitcoin!" -> NULL.
        - Example: "Launched 1 year ago" -> NULL.
        - UNLESS it explicitly says "Buy now" or "Pump it", ignore anniversaries.
        - Tweets that are just memes without text or clear signal -> NULL.
        - SPECIAL RULE: "FUN FACT" posts are usually trivia, not calls. IGNORE them unless they contain a specific price target or "Buy" command in the text.

        11. INVALIDATION / DEBUNKING RULES:
        - If a user cites a Bearish Pattern (e.g., "Bear flag", "Head and Shoulders") but immediately follows with "What they fail to show", "Context is different", "I doubt it", or "trap", they are DEBUNKING it.
        - "Bear flag... but liquidity adds context" -> BULLISH (The bear flag is wrong).
        - "Head and shoulders... but invalidation is close" -> Watch for the invalidation (likely Bullish bias).
        - "Everyone calling for 20k..." -> BULLISH (Contrarian).

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
