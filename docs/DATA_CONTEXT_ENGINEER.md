# 🎯 Role Blueprint: Data / Context Engineer (SinceThisCall)

## 🏛️ Mission Objective
The Data/Context Engineer is the "Chief Linguistic Officer" of the STC platform. Your role is to bridge the gap between high-noise social media text and high-fidelity structured financial data. You are responsible for ensuring every "call" extracted is accurate, directionally correct, and contextually aware of the current market cycle.

---

## 🛠️ Core Competencies

### 1. Linguistic Disambiguation (The "Slang" Layer)
*   **Cultural Fluency**: You must translate FinTwit idioms into binary signals. 
    *   *Example:* "Cooked," "Surviving," "Pain," "Avoiding" = **SELL**.
    *   *Example:* "We are so back," "Corn is king," "Send it" = **BUY**.
*   **Inverse Sentiment Parsing**: Recognizing when "I'm ruined" or "Bags are heavy" actually implies a **BULLISH** stance (long position suffering drawdown) vs. a bearish prediction.

### 2. Numerical Directionality (The "Math" Layer)
*   **Price Awareness**: You must inject `MARKET_CONTEXT` into the extraction layer.
*   **Delta-Validation**: If a user targets $80k for BTC while the price is $100k, you must override any "checking off boxes" and flag it as a **BEARISH** (SELL) signal. 
*   **Roadmap Logic**: Tracking checklists (✅ vs ⏳) and extracting the signal from the *next* unreached target.

### 3. Entity Proxy Resolution (The "Symbol" Layer)
*   **Nicknames**: Mapping "Corn" (BTC), "Vitalik" (ETH), and "The Dog" (DOGE).
*   **Contract Addresses (CA)**: Automatically detecting Solana/Base addresses (e.g. `85V...`) and treating them as the primary ticker for meme coins.
*   **Proxy Overrides**: Identifying when a stock (MSTR) is used as a proxy for the underlying (BTC). For official Strategy/Saylor accounts, the data subject is **BTC**.
*   **Dominance Parsing**: Understanding that a "Bearish" view on `USDT.D` (USDT Dominance) is a **BULLISH** signal for the crypto market.

### 4. Intent Discrimination (Active vs. Conditional)
*   **Active Stance**: Treating "Holding," "Betting on," and "Avoided" as immediate executable signals.
*   **Conditional Filter**: Correctly identifying "Buying IF..." or "Watching for..." as `NULL` results to prevent low-confidence data from entering the leaderboard.

---

## 🛑 Operational Protocols (The "Hard Rules")

### I. Data Integrity First
*   **Main is Truth**: All code/logic modifications MUST be pushed to the `main` branch before database synchronization.
*   **Sync Parity**: Always run `npx tsx scripts/sync-to-local.ts` after any push or pull. Never verify logic against stale local data.
*   **Schema Safety**: Never use raw `SET` commands on Redis Hashes. Use the `AnalysisStore` wrapper to prevent production-breaking data-type collisions.


### III. Validation & Logic Enforcement
*   **Strict Timestamp Integrity**: The API (`/api/recent`) must **REJECT** any request without a valid timestamp. There is no fallback to `Date.now()` (Search Time). Timeline integrity is paramount.
*   **Asset Type Segregation**: Stock searches initiated by the user must **strictly** bypass DexScreener/Crypto APIs to prevent meme-coin contamination of ticker symbols (e.g. $MSTR, $AAPL).
*   **Dynamic Market Context**: The AI must be fed real-time prices (BTC/ETH/SOL) via `MARKET_CONTEXT` injection to correctly validate "Numerical Directionality" (e.g. Buying BTC at $90k when market is $100k = Bearish/Short).

### IV. Fix Protocols
*   **Main First**: Data repairs (scripts) must target **Production** first. Local environment is downstream from Main.
*   **Scripted Repairs**: Never manually edit database entries. Create reusable scripts committed to `main`:
    *   `scripts/repair-all-users.ts`: For historical timestamp/price corrections.
    *   `scripts/backfill-tickers.ts`: For rebuilding the ticker index.
    *   `scripts/reanalyze.ts`: For individual fix-ups.

---

## 🧪 Tech Stack Proficiency
*   **AI**: Gemini 2.0 Flash (Multimodal) for text + chart analysis.
*   **Data**: Redis (Upstash/LocalProxy) with a focus on Hash/List parity.
*   **Pricing**: CA-Aware Waterfall (GeckoTerminal Historical -> DexScreener -> CoinGecko -> Yahoo Finance).

### V. Context Hardening Protocol
*   **The Problem**: AI sometimes misinterprets nuance (e.g., "Buying Dips" = Bearish).
*   **The Process**:
    1.  **Debug**: Create a script (`scripts/debug-[case].ts`) to fetch the raw AI output. Identify the specific "Reasoning" failure.
    2.  **RCA**: Determine if the error is due to a prompt rule (e.g., "Target Rule") overriding intuition.
    3.  **Harden**: Update `ai-extractor.ts` prompt with a specific **OVERRIDE RULE**. Use explicit triggers ("Best Chart", "Accumulating") to force the correct sentiment.
    4.  **Verify**: Re-run the debug script to confirm the prompt change works.
    5.  **Repair**: Run a `fix-[case].ts` script to correct the specific Production entry.



### VI. Market Data Reliability Protocol
*   **Stock Whitelisting**: Tickers that look like crypto but are stocks (e.g. `ONDS`, `ASST`) must be added to `KNOWN_STOCKS` in `market-data.ts`. This prevents DexScreener contamination.
*   **Recent Date Fallback**: Yahoo Finance Historical API is unreliable for "Today's" data. Logic must fallback to **Current Price** if the historical fetch fails for a date < 24h old.
*   **Type Enforcement**: Major assets (BTC, ETH, SOL) must be hard-coded as `CRYPTO` in `price-updater.ts` to prevent "Stock" misclassification (e.g. ETH -> Ethan Allen).

### VII. Local Environment Protocol
*   **Redis Client**: Do not use `eval('require')` hacks for `ioredis`. Configure `serverComponentsExternalPackages: ['ioredis']` in `next.config.mjs` to support local drivers natively.
*   **Port Discipline**: Local apps run on 3000 (Main) and 3001 (Twitter Watcher). Ensure no zombie processes before starting `dev`.

---

*Blueprint Version: 2.3 (Jan 26, 2026)*
