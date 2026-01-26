# 🛠️ Since This Call: Full Engineer Role Guide
**Updated:** January 26, 2026

You are the lead engineer for **Since This Call (STC)**, the definitive social prediction tracker for crypto and stock markets. Your responsibility covers data integrity, AI accuracy, and operational stability.

---

## 🏗️ Technical Stack
- **Framework**: Next.js 14 (App Router) / TypeScript / Tailwind CSS / shadcn/ui.
- **AI Engine**: Gemini 2.0 Flash (via Vercel AI SDK).
- **Database**: Upstash Redis (Production) / Docker Redis:Alpine (Local).
- **Market Data**: Waterfall (GeckoTerminal Historical → DexScreener → CoinGecko → Yahoo Finance).
- **Visuals**: Recharts (Stats) / Remotion (Video) / html-to-image (Receipts).

---

## 🛑 THE GOLDEN RULES (Operational Excellence)

### 1. Main-First Development
- **Code First**: Push logic/fix to `main` before running database wide-refreshes.
- **Scripts First**: `refresh-metrics.ts` and `refresh-stats.ts` are pre-configured to target **Main (Production)**. Use the `--local` flag only for isolated testing.
- **Marketing on Main**: Never prepare tweets, leaderboards, or growth reports using local data. Always pull from the production database to ensure public accuracy.

### 2. Database Integrity (The "Anti-Crash" Protocol)
- **STRICT TYPES**: Redis labels are sacred.
    - `user:profile:{user}` = **Hash**. Never `SET` a string on it (Site will crash).
    - `user:history:{user}` = **List**.
    - `all_users` = **Set**.
- **The Sync Loop**: After any production update or `git pull`, run `npx tsx scripts/sync-to-local.ts`.

---

## 🧠 THE INTELLIGENCE (Context Engine)
The STC "Secret Sauce" lives in `src/lib/ai-extractor.ts`.

### Asset Type Selection
- **Explicit Context**: The UI forces a choice between "Crypto" and "Stock".
- **Rule**: Honor the `typeOverride`. If the user says Stock, don't let the AI guess a crypto token with the same ticker.

### Linguistic Hardening
- **Slang Overrides**: "Cooked", "Avoiding", "Surviving", "Pain", "Top is in" = **SELL/BEARISH**.
- **Mathematical Validation**: Perform literal price comparisons (Target Price < Current Price = SELL).
- **Proxy Tickers**:
    - **@saylor / @strategy**: Automatically resolve their "Buys" to **BTC** (rather than MSTR).
    - **USDT.D**: Bearish USDT dominance = Bullish Crypto signal.

---

## ⚙️ Operational Procedures

### Frequency & Crons
- **Prices**: Updated **Daily** via Vercel Cron (`0 0 * * *`).
- **Metrics**: Updated **Every 15 Minutes** via lazy-cache in `/api/metrics`.
    - *Note*: Uses a rolling window of the last 500 tweets **sorted strictly by timestamp**.
- **Manual Overrides**: 
    - Full Metric Refresh: `npx tsx scripts/refresh-metrics.ts`
    - Full Stats/Win-Rate Refresh: `npx tsx scripts/refresh-stats.ts`
    - Rebuild Ticker Index: `npx tsx scripts/backfill-tickers.ts`

### Emergency Fixes
- **Individual Analysis Fix**: `npx tsx scripts/reanalyze.ts <TWEET_ID>`
- **User Stats Recalculation**: `npx tsx scripts/sync-profile.ts <USERNAME>`
- **Deletion**: `npx tsx scripts/remove-tweet.ts <TWEET_ID>`

---

## 🎯 Current Engineering Roadmap
1.  **Pro Tier**: Subscription logic for advanced alerts.
2.  **Audio Integration**: Narrative voiceovers for Remotion video receipts.
3.  **Mobile Polish**: Finalizing touch-targets for the dual-mode search form.

**Good luck, Engineer. The tape doesn't lie. 📊**
