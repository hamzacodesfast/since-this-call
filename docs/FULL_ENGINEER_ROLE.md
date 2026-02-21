# 🛠️ Since This Call: Full Engineer Role Guide
**Updated:** February 21, 2026

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
- **Scripts First**: `refresh-metrics.ts` and `refresh-stats.ts` (which now uses `recalculate-all-production.ts`) are pre-configured to target **Main (Production)**. Use the `--local` flag only for isolated testing.
- **Marketing on Main**: Never prepare tweets, leaderboards, or growth reports using local data. Always pull from the production database to ensure public accuracy.
- **Build Verification**: Run `npm run build` locally before every major push.
- **Vercel Optimization**: A `.vercelignore` exists to exclude `services/`, `videos/`, and `scripts/` from the production build to prevent dependency conflicts (e.g. Puppeteer).

### 2. Database Integrity (The "Anti-Crash" Protocol)
- **STRICT TYPES**: Redis labels are sacred.
    - `user:profile:{user}` = **Hash**. Never `SET` a string on it (Site will crash).
    - `user:history:{user}` = **List**.
    - `all_users` = **Set**.
    - `tracked_tickers` = **Set**.
- **The Sync Loop**: After any production update or `git pull`, run `npx tsx scripts/sync-to-local.ts`. 

---

## 🧠 THE INTELLIGENCE (Context Engine)
The STC "Secret Sauce" lives in `src/lib/ai-extractor.ts`.

### Asset Type Selection
- **Explicit Context**: The UI forces a choice between "Crypto" and "Stock".
- **Rule**: Honor the `typeOverride`.

### Linguistic Hardening
- **Slang Overrides**: "Cooked", "Avoiding", "Surviving", "Pain", "Top is in" = **SELL/BEARISH**.
- **Word-Tickers**: Special handling for tokens that look like words (e.g., `$HYPE`). AI is instructed to treat them as tickers ONLY if the surrounding context is financial.
- **Noise Detection**: Automatically ignores "Live Show" / "Space" notifications that don't contain actual calls.
- **Hard Bearish Signal**: Explicit instructions added to handle persistent bears (e.g. Peter Schiff on $BTC) to ensure negative sentiment is captured as SELL, not NULL.

---

## ⚙️ Operational Procedures

### Frequency & Crons
- **Prices**: Updated **Daily** via Vercel Cron (`0 0 * * *`).
- **Leaderboard**: **CRITICAL: Minimum 20 calls required** to appear on the leaderboard to ensure data reliability.
- **Manual Overrides**: 
    - Full Metric Refresh: `npx tsx scripts/refresh-metrics.ts`
    - Full Stats/Win-Rate Refresh: `npx tsx scripts/refresh-stats.ts`.
    - Rebuild Ticker Index: `npx tsx scripts/backfill-tickers.ts`

### Emergency Fixes
- **Individual Analysis Fix**: `npx tsx scripts/reanalyze.ts <TWEET_ID>`
- **User Stats Recalculation**: `npx tsx scripts/recalculate-all-production.ts` (for whole DB sync).

---

## 🐦 Twitter Watcher Service

An automated Puppeteer-based watcher that monitors your Twitter timeline for financial calls and submits them to STC.

**Location**: `services/twitter-watcher/`

### Maintenance
- **Logout / Reset**: To logout or switch accounts, delete the `.chrome-profile` folder: `rm -rf services/twitter-watcher/.chrome-profile`.

### Commands
```bash
npm run login    # Open browser to log in (saves session)
npm run watch    # Start watcher (visible browser)
npm run watch -- --headless  # Run headless (standard for production)
```

---

## 🎯 Current Engineering Roadmap
1.  **Pro Tier**: Subscription logic for advanced alerts (Implementation pending).
2.  **Mobile Polish**: Enhancing touch-targets for the dual-mode search form.
3.  **Video Narration**: Automating voiceovers for receipt videos.

**Good luck, Engineer. The tape doesn't lie. 📊**
