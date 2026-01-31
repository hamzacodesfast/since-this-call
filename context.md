# 🧠 Agent Handoff Context

**Project:** SinceThisCall (STC) - "Call Receipts for Crypto/Meme Twitter"  
**Current Status:** Production (Main Branch - Hardened)  
**Last Updated:** January 30, 2026  

---

> [!CAUTION]
> **DEVELOPMENT MANDATE**: Do NOT use Moltbot for any development, coding, or data tasks. Use **Antigravity** and its models strictly.


## 🛑 HARD RULES (FOR AGENTS)
1. **PUSH TO MAIN FIRST**: All logic/code changes MUST be committed and pushed to `main` before any other actions.
2. **SYNC-TO-LOCAL**: Run `npx tsx scripts/sync-to-local.ts` after any push to ensure your local environment reflects the live production data.
3. **NO REDIS TYPE OVERWRITES**: Never overwrite a Hash (`user:profile`) with a String. Use `AnalysisStore` abstractions.
4. **MARKETING ON MAIN**: Always prepare tweets and marketing content using **Production** stats (Main database). Never use local data for public performance reports.

---

## 📊 Current Metrics (Jan 31, 2026 - Live Refresh)

| Metric | Value |
|--------|-------|
| Total Analyses | 1,900 |
| Unique Gurus | 553 |
| Tracked Tickers | 299 |
| Platform Win Rate| 41% |
| Verified Edge Cases| 101 |

---

## 🏗️ Core Architecture

- **Framework:** Next.js 14 (App Router) + TypeScript + TailwindCSS
- **Database:** Upstash Redis (REST API)
  - **Local Dev:** Uses standard `redis:alpine` Docker container.
  - **Redis Wrapper:** `src/lib/redis-wrapper.ts` (IORedis proxy) handles protocol translation.
  - **Unified Client:** `src/lib/redis-client.ts` automatically switches between Local Proxy and Production Upstash based on env.
- **AI Engine:** `src/lib/ai-extractor.ts` using Gemini 2.0 Flash (Tier 1 / Paid).
  - **Asset Type Selection:** Now supports explicit "Crypto" vs "Stock" selection for higher accuracy.
- **Pricing Engine:** `src/lib/market-data.ts` (CA-Aware Waterfall: GeckoTerminal -> DexScreener -> CoinGecko -> Yahoo Finance).

## 🆕 Recent Features (Jan 24-25, 2026)

1.  **Historical Pricing Integrity**
    - **Fix:** System now uses **Tweet Creation Date** (not analysis time) for all entry prices.
    - **Repair:** Full database repair run on all 245 gurus.
2.  **Contract Address (CA) Awareness**
    - **Analyzer:** Automatically extracts CAs for meme coins (Solana/Base).
    - **Price Refresher:** Now supports CA-based historical lookups via GeckoTerminal.
    - **Impact:** Accurate "Win/Loss" tracking for low-cap tokens.
3.  **Asset Type Selection (Search)**
    - Two-step flow on homepage: Choose "Analyze Crypto" or "Analyze Stock" first.
4.  **Main-First Maintenance Scripts**
    - `refresh-metrics.ts` and `refresh-stats.ts` now prioritize `.env.production`.
5.  **Metrics Engine Upgrade** (Jan 26)
    - **Logic**: "Most Tracked" now uses a strictly timestamp-sorted window of the last 500 tweets.
    - **Fix**: Resolved "ghost calls" discrepancy by forcing cache refresh on production.
6.  **Full Environment Parity**
    - Local dev environment now fully synced with production snapshot (1,500+ analyses).
7.  **UX Enhancement (Jan 30)**
    - **Renaming**: "Most Tracked Tickers" -> "Trending Tickers" to better reflect the dynamic nature of the list.

## 📂 Key Files

| File | Purpose |
|------|---------|
| `src/app/api/metrics/route.ts` | Platform metrics + topTickers |
| `src/app/stats/page.tsx` | Stats dashboard page |
| `src/components/charts/` | Chart components (recharts) |
| `src/lib/ai-extractor.ts` | **BATTLE-HARDENED LINGUISTIC ENGINE** |
| `src/lib/price-refresher.ts` | Ticker price update logic |

## 🛠️ Admin Scripts

| Script | Purpose |
|--------|-------|
| `sync-to-local.ts` | **HARD RULE:** Run after `git pull` or prod check. |
| `sync-to-production.ts` | **DANGEROUS:** Overwrites Live with Local. |
| `local-redis-proxy.ts` | Runs the local Redis server with the Upstash-compatible proxy. |
| `reanalyze.ts` | Fix incorrect analysis for a tweet ID. |
| `remove-tweet.ts` | Delete a single analysis from history and recent. |
| `bulk-analyze.ts` | Process a JSON list of tweet URLs into the DB. |
| `backup-data.ts` | Export all Redis data to JSON. |
| `restore-users.ts` | Restore users from a backup file. |

## 🎯 Immediate Priorities

1. **Content Marketing** - Post prepared tweets in `/brain/.../marketing_content.md`
2. **Video Narration** - Add audio to Remotion videos in `videos/`
3. **Pro Tier** - Implement subscription features
4. **1K Follower Target** - Estimated mid-March

## 📜 Standard Procedures

### Wrong Analysis Fix
`npx tsx scripts/reanalyze.ts <TWEET_ID>`

### Force Metrics Refresh
`curl -X POST http://localhost:3000/api/metrics`

### Price Refresh (All Tickers)
`curl http://localhost:3000/api/cron/refresh`

---

**Good Luck, Agent! 🫡**
