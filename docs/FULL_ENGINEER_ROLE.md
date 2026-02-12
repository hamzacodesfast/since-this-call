# 🛠️ Since This Call: Full Engineer Role Guide
**Updated:** February 7, 2026

You are the lead engineer for **Since This Call (STC)**, the definitive social prediction tracker for crypto and stock markets. Your responsibility covers data integrity, AI accuracy, and operational stability.

---

> [!IMPORTANT]
> **OPERATIONAL RULE**: Use only **Antigravity** models for all engineering tasks.


## 🏗️ Technical Stack
- **Framework**: Next.js 14 (App Router) / TypeScript / Tailwind CSS / shadcn/ui.
- **AI Engine**: Gemini 2.0 Flash (via Vercel AI SDK).
- **Database**: Upstash Redis (Production) / Docker `redis:alpine` (Local).
- **Market Data**: Waterfall (Yahoo Finance → CoinMarketCap → CoinGecko).
- **Visuals**: Recharts (Stats) / Remotion (Video) / html-to-image (Receipts).

---

## 🛑 THE GOLDEN RULES (Operational Excellence)

### 1. Main-First Development
- **Code First**: Push logic/fix to `main` before running database wide-refreshes.
- **Scripts First**: `refresh-metrics.ts` and `refresh-stats.ts` are pre-configured to target **Main (Production)**. Use the `--local` flag only for isolated testing.
- **Marketing on Main**: Never prepare tweets, leaderboards, or growth reports using local data. Always pull from the production database to ensure public accuracy.
- **Build Verification**: Run `npm run build` locally before every major push to ensure zero TypeScript or routing regressions.

### 2. Database Integrity (The "Anti-Crash" Protocol)
- **STRICT TYPES**: Redis labels are sacred.
    - `user:profile:{user}` = **Hash**. Never `SET` a string on it (Site will crash).
    - `user:history:{user}` = **List**.
    - `all_users` = **Set**.
    - `tracked_tickers` = **Set**.
- **The Sync Loop**: After any production update or `git pull`, run `npx tsx scripts/sync-to-local.ts`. 
- **Verification**: Post-sync, verify integrity with `docker exec redis-local redis-cli dbsize`.

---

## 🧠 THE INTELLIGENCE (Context Engine)
The STC "Secret Sauce" lives in `src/lib/ai-extractor.ts`.

### Asset Type Selection
- **Explicit Context**: The UI forces a choice between "Crypto" and "Stock".
- **Rule**: Honor the `typeOverride`. If the user says Stock, don't let the AI guess a crypto token with the same ticker.

### Linguistic Hardening
- **Slang Overrides**: "Cooked", "Avoiding", "Surviving", "Pain", "Top is in" = **SELL/BEARISH**.
- **Mocking/Skepticism**: "Tried to warn you", "Financial illiteracy", "Dumpster Fire", "Ponzi", "Not a store of value" = **SELL/BEARISH**.
- **Regret/FOMO**: "Regret Selling" (Bearish), "Stupid FOMO" (Bearish), "Speculating to Accumulate" (Bullish).
- **Mathematical Validation**: Perform literal price comparisons (Target Price < Current Price = SELL).
- **Proxy Tickers**:
    - **@saylor / @strategy**: Automatically resolve their "Buys" to **BTC** (rather than MSTR).
    - **USDT.D**: Bearish USDT dominance = Bullish Crypto signal.

### Regression Prevention
- **Prompt Sensitivity**: The AI prompt is highly tuned with 200+ examples. **Never** delete examples from the prompt without testing against known tricky tweets using `npx tsx scripts/reanalyze.ts`.

### Pricing Accuracy (The "Dead Zone" Fix)
- **Problem**: Tweets from 8 PM - 4 AM EST traditionally returned "future" market data.
- **Solution**: The `PriceUpdater` now uses a **12-hour high-precision search window** for historical tweets, falling back to the *closest past close* rather than future open.

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

## 🐦 Twitter Watcher Service

An automated Puppeteer-based watcher that monitors your Twitter timeline for financial calls and submits them to STC.

**Location**: `services/twitter-watcher/`

### Commands
```bash
npm run login    # Open browser to log in (saves session)
npm run watch    # Start watcher (visible browser)
npm run watch -- --headless  # Run headless
npm run watch -- --dry-run   # Test without submitting
```

### How It Works
1. Scrolls timeline every 60 seconds (infinite scroll + page refresh every 10 cycles)
2. Detects tweets with **$TICKER + action signal** (long, short, buy, sell, bullish, etc.)
3. Submits matching tweets to `/api/analyze` (auto-saves to Redis)
4. Logs all detected calls to `detected-calls.json` (also used for deduplication)

### Configuration (`config.ts`)
- `targetUrl`: Twitter URL to monitor (default: home timeline)
- `pollInterval`: Check frequency (default: 60s)
- `tickerPattern`: Regex for ticker symbols
- `actionPatterns`: Regex array for action signals

### Files
- `detected-calls.json` — Log of all detected financial calls
- `.chrome-profile/` — Isolated browser session (gitignored)

---

## 🎯 Current Engineering Roadmap
1.  **Pro Tier**: Subscription logic for advanced alerts (Implementation pending).
2.  **Mobile Polish**: Enhancing touch-targets for the dual-mode search form.
3.  ~~**Twitter Watcher**: Automated call detection from timeline.~~ ✅ Complete

**Good luck, Engineer. The tape doesn't lie. 📊**
