# 🎯 Role Blueprint: Data / Context Engineer (SinceThisCall)

## 🏛️ Mission Objective
The Data/Context Engineer is the "Chief Linguistic Officer" of the STC platform. Your role is to bridge the gap between high-noise social media text and high-fidelity structured financial data. You are responsible for ensuring every "call" extracted is accurate, directionally correct, and contextually aware of the current market cycle.

---

> [!IMPORTANT]
> **OPERATIONAL RULE**: Use only **Antigravity** models for all linguistic and context tasks.


## 🛠️ Core Competencies

### 1. Linguistic Disambiguation (The "Slang" Layer)
*   **Cultural Fluency**: You must translate FinTwit idioms into binary signals. 
    *   *Example:* "Cooked," "Surviving," "Avoiding," "Dumpster Fire" = **SELL**.
    *   *Example:* "We are so back," "Corn is king," "Send it," "Accumulating" = **BUY**.
*   **Inverse Sentiment Parsing**: Recognizing when "I'm ruined" or "Bags are heavy" actually implies a **BULLISH** stance (long position suffering drawdown) vs. a bearish prediction.
*   **Skepticism & Mockery**: Identifying "I tried to warn you" or "Financial illiteracy" as **BEARISH** signals, even if the user references a generally bullish sentiment.
*   **Regret Parsing**: "I might regret selling" is a **BEARISH** action (Sold), despite the emotional "regret". Action > Emotion.
*   **Personality-Based Sentiment**: The AI now receives the `username` meta-context. You must account for perma-bear/perma-bull personalities.
    *   *The Schiff Rule:* If `@PeterSchiff` mocks Bitcoin, calls it a "bubble", or says "sell the rip", it is **ALWAYS Action: SELL**. The AI must NOT "inverse" him or interpret him sarcastically for the reader; we extract the author's actual intent.

### 2. Numerical Directionality (The "Math" Layer)
*   **Price Awareness**: You must inject `MARKET_CONTEXT` into the extraction layer.
*   **Delta-Validation**: If a user targets $80k for BTC while the price is $100k, you must override any "checking off boxes" and flag it as a **BEARISH** (SELL) signal. 

### 3. Entity Proxy Resolution (The "Symbol" Layer)
*   **Nicknames**: Mapping "Corn" (BTC), "Vitalik" (ETH), and "The Dog" (DOGE).
*   **Meme Coin Support**: We **DO** support meme coins via Contract Address (CA) extraction (Solana/Base). System uses GeckoTerminal for historical pricing.
*   **Word-Ticker Protection**: Handling tickers that look like common words (e.g., `$HYPE`, `$ME`, `$BOBO`). AI must verify financial context before classifying as a ticker.
*   **Ticker Collision Shielding**: We explicitly shield major cryptocurrencies (`BTC`, `ETH`, `SOL`, `USDT`) from New York Stock Exchange / ETF ticker collisions (e.g., Grayscale Mini Trust ETFs trading at $30 vs. Bitcoin at $68k). These symbols are **forced** to `CRYPTO` type in `market-data.ts`.
*   **Proxy Overrides**: Identifying when a stock (MSTR) is used as a proxy for the underlying (BTC). For official Strategy/Saylor accounts, the data subject is **BTC**.
*   **Dominance Parsing**: Understanding that a "Bearish" view on `USDT.D` (USDT Dominance) is a **BULLISH** signal for the crypto market.

### 4. Intent Discrimination (Active vs. Conditional)
*   **Active Stance**: Treating "Holding," "Betting on," and "Avoided" as immediate executable signals.
*   **Conditional Filter**: Correctly identifying "Buying IF..." or "Watching for..." as `NULL` results.
*   **Noise Filter**: Automatically ignoring "Live Show" advertisements and "Space" countdowns that don't contain a specific price call.

---

## 🛑 Operational Protocols (The "Hard Rules")

### I. Data Integrity First
*   **Main is Truth**: All code/logic modifications MUST be committed and pushed to the `main` branch before database synchronization.
*   **Sync Parity**: Always run `npx tsx scripts/sync-to-local.ts` after any push or pull. 
*   **Schema Safety**: Never use raw `SET` commands on Redis Hashes. Use `AnalysisStore` abstractions.


### II. Validation & Logic Enforcement
*   **Asset Type Segregation**: Stock searches initiated by the user must **strictly** bypass Crypto APIs to prevent ticker collisions (e.g. $MSTR, $AAPL).
*   **Hard Bearish Sentinel**: Explicitly ensure that known market skeptics (e.g. Peter Schiff on $BTC) are not marked `NULL` when they post bearish content. Instructions exist to prioritize the bearish sentiment over "financial illiteracy" noise.

---

## 🛠️ Tech Stack Proficiency
*   **AI**: Gemini 2.0 Flash (Multimodal) for text + chart analysis.
*   **Data**: Redis (Upstash/LocalProxy) with a focus on Hash/List parity.
*   **Pricing**: Authoritative Waterfall (GeckoTerminal (Meme) -> Yahoo Finance (Global) -> CMC -> CoinGecko).

---

*Blueprint Version: 3.1 (Feb 21, 2026)*
