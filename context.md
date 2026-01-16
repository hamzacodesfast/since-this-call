# 🧠 Agent Handoff Context

**Project:** SinceThisCall (STC) - "Call Receipts for Crypto/Meme Twitter"
**Current Status:** Production (Main Branch)
**Next Agent Goal:** Maintenance, Stability, and Feature Expansion (Cron Jobs).

---

## 🏗️ Core Architecture
- **Framework:** Next.js 14 (App Router) + TypeScript + TailwindCSS.
- **Database:** Upstash Redis (REST API), handled in `src/lib/analysis-store.ts`.
- **AI Engine:** `src/lib/ai-extractor.ts` using Gemini 2.0 Flash Exp (or 1.5 Flash).
    - **Logic:** Extracts Symbol + Sentiment (Bullish/Bearish) + Contract Address (CA).
    - **Key Feature:** Detects "Doomposting" (e.g. "cleanse", "capitulation") as BEARISH.
- **Pricing Engine:** `src/lib/market-data.ts` (The "Waterfalls" Logic).
    1. **Pre-Market Check:** `LAUNCH_DATES` (e.g. BTC 2009 launch date logic).
    2. **Yahoo Finance:** Priority for Stocks (BMNR, NVDA) & Major Crypto.
    3. **CoinMarketCap:** High priority for Current Crypto Prices.
    4. **CoinGecko:** PRIMARY for Historical Data & broad coverage. Maps `ASTER` -> `aster-2`.
    5. **DexScreener:** Fallback for obscure Meme Coins (SOL/Base).
    6. **GeckoTerminal:** Fallback for DexScreener precision.

## 🛠️ Recent Fixes (CRITICAL - DO NOT BREAK)
1.  **Pricing Integrity**:
    - **Aesthetics**: Dark mode, premium feel, green/red/yellow performance cards.
    - **Fake Token Prevention**: Explicitly bypass DexScreener for known tokens (e.g. `ME`, `PUMP`) to stop "fake liquidity" analysis.
    - **Stock Disambiguation**: `src/lib/analyzer.ts` has a `FORCE_STOCKS` list (BMNR, MSFT, etc.) to prevent AI from misclassifying stocks as garbage crypto tokens.
2.  **Backup System**:
    - `scripts/backup-data.ts`: Uses `hgetall` for user profiles (stored as Redis Hashes). **Do not revert to `get`**.
3.  **Share Receipt**:
    - Profile Page (`src/components/profile-view.tsx`) now has a "Share Receipt" button using `html-to-image`.
4.  **Price Accuracy**:
    - `market-data.ts`: CoinGecko now requests HOURLY granularity for 2-90 day old tweets (automatic via `days` param).
5.  **Validation System**:
    - `analyzer.ts`: Throws `Mismatch Error` if Tweet CA != User Provided CA, or if Tweet Symbol != Link Symbol (strict anti-hijack).
6.  **Profile Sync**:
    - `recalculateUserProfile`: Function added to `analysis-store.ts` to re-sync User Profile stats (wins/losses) from history list.
    - Script: `scripts/sync-profile.ts` available for manual fix.

## 🚨 Known Issues / TODOs
1.  **Price Refresh:** Currently prices are static from the moment of analysis. We need a Cron Job to refresh `currentPrice` for open calls.
2.  **Rate Limits:** Public APIs (CoinGecko free tier) might hit limits under load.
3.  **DexScreener History:** For tokens > 24h old but not on CG/CMC, DexScreener history is limited.

## 📜 Standard Procedures
- **Wrong Analysis Fix:**
    1.  Run `scripts/remove-tweet.ts` (or custom script) to delete from Redis.
    2.  If it was a token mismatch, add mapping to `market-data.ts` (CoinGecko) or `analyzer.ts` (Stock Override).
    3.  Commit fix -> Deploy -> Re-analyze.
- **Backups:** Run `npx tsx scripts/backup-data.ts` before major migrations.

## 📂 Key Files
- `src/lib/market-data.ts`: The source of truth for pricing.
- `src/lib/ai-extractor.ts`: The brain (Prompt Engineering).
- `src/app/page.tsx`: The main analysis UI.
- `src/app/user/[username]/page.tsx`: The Profile Page.

**Good Luck, Agent! 🫡**
