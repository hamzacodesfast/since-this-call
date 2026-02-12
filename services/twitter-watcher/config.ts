/**
 * @file config.ts
 * @description Configuration for the Twitter Watcher
 */
import * as path from 'path';
import { fileURLToPath } from 'url';

import { MONITORED_ASSETS } from './assets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
    // Isolated Chrome profile for the watcher
    chromeProfilePath: path.join(__dirname, '.chrome-profile'),

    // Twitter list URL to monitor (change this to your tracked gurus list)
    // Or use 'https://x.com/home' for home timeline
    targetUrl: 'https://x.com/home',

    // How often to check for new tweets (ms)
    pollInterval: 5_000, // 5 seconds (active scroll)

    // STC Production API endpoint
    stcApiUrl: 'https://www.sincethiscall.com/api/analyze',

    // File to log detected calls (also used for deduplication)
    detectedCallsFile: path.join(__dirname, 'detected-calls.json'),

    // Detection requires BOTH (ticker OR asset name) AND an action signal
    tickerPattern: /\$[A-Z]{2,6}\b/i, // $BTC, $ETH, $NVDA (2-6 chars)

    // Common asset names to match (case insensitive)
    assetNames: MONITORED_ASSETS,

    // Action patterns matching ai-extractor.ts signal vocabulary
    actionPatterns: [
        // Direct position statements
        /\b(long(ing|ed)?|short(ing|ed)?)\b/i,
        /\b(buy(ing)?|sell(ing)?|sold)\b/i,
        /\b(bullish|bearish)\b/i,

        // Accumulation signals
        /\b(accumulating|loading|bidding|scooping)\b/i,
        /\b(added|adding)\s+(to\s+)?(my\s+)?(position|bag)/i,
        /\bload(ing)?\s+(up|the\s+boat)\b/i,

        // Entry/Target signals
        /\bprice\s+target/i,
        /\bpt[:\s]+\$?\d/i,
        /\b(entry|entered|entering)\b/i,
        /\btarget(ing)?\s+\$?\d/i,

        // Chart pattern signals (from ai-extractor)
        /\b(cup\s+and\s+handle|bull\s+flag|bear\s+flag|breakout|breakdown)\b/i,
        /\b(golden\s+cross|death\s+cross|head\s+and\s+shoulders)\b/i,
        /\b(rising\s+wedge|falling\s+wedge|ascending\s+triangle)\b/i,

        // Guru rhetoric (from ai-extractor)
        /\b(bottom\s+is\s+in|top\s+is\s+in|local\s+top)\b/i,
        /\b(calm\s+before\s+the\s+storm|worst\s+is\s+over)\b/i,
        /\b(ready\s+for\s+takeoff|ready\s+for\s+breakout)\b/i,
        /\b(diamond\s+hands|paper\s+hands)\b/i,
        /\b(still\s+not\s+selling|not\s+selling|hodl)\b/i,
        /\b(dip\s+is\s+for\s+buying|buy\s+the\s+dip|btfd)\b/i,

        // Bearish signals  
        /\b(take\s+profits|ring\s+the\s+register|booking\s+gains)\b/i,
        /\b(topped\s+out|blow\s+off\s+top|exhaustion)\b/i,
        /\b(avoiding|stay\s+out|cooked|rekt)\b/i,
        /\b(sweep\s+(the\s+)?lows|new\s+lows)\b/i,

        // Conviction signals
        /\b(generational\s+(opportunity|wealth)|free\s+money)\b/i,
        /\b(betting\s+(it\s+all|the\s+farm))\b/i,
        /\b(moon|rocket|send\s+it|lfg)\b/i,
    ],

    // Max tweets to process per scroll cycle
    maxTweetsPerCycle: 20,
};
