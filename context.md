# 🧠 Agent Handoff Context

**Project:** SinceThisCall (STC) - "Call Receipts for Crypto/Meme Twitter"  
**Current Status:** Production (Main Branch - Hardened)  
**Last Updated:** January 24, 2026  

---

## 🛑 HARD RULES (FOR AGENTS)
1. **PUSH TO MAIN FIRST**: All logic/code changes MUST be committed and pushed to `main` before any other actions.
2. **SYNC-TO-LOCAL**: Run `npx tsx scripts/sync-to-local.ts` after any push to ensure your local environment reflects the live production data.
3. **NO REDIS TYPE OVERWRITES**: Never overwrite a Hash (`user:profile`) with a String. Use `AnalysisStore` abstractions.

---

## 📊 Current Metrics (Jan 24, 2026)

| Metric | Value |
|--------|-------|
| Tracked Calls | 570+ |
| Unique Gurus | 310+ |
| Verified Edge Cases | 101 |
| Platform Win Rate | 39% |
| Website MAU | 120 |

---

## 🏗️ Core Architecture

- **Framework:** Next.js 14 (App Router) + TypeScript + TailwindCSS
- **Database:** Upstash Redis (REST API)
  - **Local Dev:** Uses `ioredis` wrapped in `LocalRedisWrapper` (Proxy) to simulate Upstash API.
  - **Production:** Uses `@upstash/redis` (Direct REST) for Edge compatibility.
  - **Schema Enforced:** `user:profile:*` (Hash), `user:history:*` (List), `all_users` (Set).
  - **Critical Rule:** Never overwrite a Hash with a String. Every refresh of Prod MUST be followed by a `sync-to-local`.
- **AI Engine:** `src/lib/ai-extractor.ts` using Gemini 2.0 Flash Exp.
  - **Context Engine (Hardened):** Now highly resilient with 100+ verified edge cases.
    - **Slang Overrides:** "Cooked", "Survive", "Avoiding", "Pain" = SELL.
    - **Math Logic:** Performs accurate numerical comparison (Target < Current = SELL).
    - **Proxy Logic:** Prioritizes underlying assets (e.g., @Strategy outputting BTC instead of MSTR).
    - **Market Psych:** Correctly identifies "Where are we?" (Cycle Top) and "Goldilocks" (Complacency) as SELL signals.
  - **Improved Fallback:** Highly robust Regex system for hashtags (#BTC) and plain-text tickers (Palantir -> PLTR).
- **Pricing Engine:** `src/lib/market-data.ts` (Waterfall: DexScreener -> CoinGecko -> Yahoo Finance)
- **Charts:** `recharts` library in `src/components/charts/`

## 🆕 Recent Features (Jan 2026)

1. **Charts Section** (`/stats` page)
   - Platform stats dashboard with pie/bar charts.
2. **AsterDex Monetization**
   - Referral banners on `/recent`, `/leaderboard`, `/stats`.
3. **Most Tracked Tickers** (`/api/metrics`)
   - Includes sentiment split and win rate per ticker.
4. **Context Engine Hardening (Jan 24)**
   - 101/101 Verified edge cases (Linguistics, Slang, Math, Psych).
   - "MSTR/Saylor Proxy" rule: Prioritize BTC for @Strategy/@saylor.
   - "USDT.D" Directive: Bearish USDT.D = Bullish Crypto signal.

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
