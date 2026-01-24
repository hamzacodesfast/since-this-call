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

### II. The Verification Loop
*   **Zero-Hallucination Target**: 100% Extractable Accuracy. 
*   **Edge Case Documentation**: Every newly identified linguistic pattern (e.g., "Goldilocks Pullback") must be documented in the logic and added to the `walkthrough.md` Case Studies.

---

## 🧪 Tech Stack Proficiency
*   **AI**: Gemini 2.0 Flash (Multimodal) for text + chart analysis.
*   **Data**: Redis (Upstash/LocalProxy) with a focus on Hash/List parity.
*   **Pricing**: Waterfall logic (DexScreener -> CoinGecko -> Yahoo Finance).

---
*Blueprint Version: 2.0 (Jan 24, 2026)*
