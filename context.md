# 🧠 Agent Handoff Context

**Project:** SinceThisCall (STC) - "Call Receipts for Crypto/Meme Twitter"  
**Current Status:** Production (Main Branch)  
**Last Updated:** January 23, 2026  

---

## 📊 Current Metrics (Jan 23, 2026)

| Metric | Value |
|--------|-------|
| Tracked Calls | 536 |
| Unique Gurus | 236 |
| Unique Tickers | 134 |
| Platform Win Rate | 39% |
| Twitter Followers | ~150 |
| Website MAU | 85 |

---

## 🏗️ Core Architecture

- **Framework:** Next.js 14 (App Router) + TypeScript + TailwindCSS
- **Database:** Upstash Redis (REST API)
  - **Local Dev:** Uses `ioredis` wrapped in `LocalRedisWrapper` (Proxy) to simulate Upstash API.
  - **Production:** Uses `@upstash/redis` (Direct REST) for Edge compatibility.
  - **Schema Enforced:** `user:profile:*` (Hash), `user:history:*` (List), `all_users` (Set).
  - **Critical Rule:** Never overwrite a Hash with a String. Every refresh of Prod MUST be followed by a `sync-to-local`.
- **AI Engine:** `src/lib/ai-extractor.ts` using Gemini 2.0 Flash Exp.
  - **Improved Fallback:** Highly robust Regex system for hashtags (#BTC) and plain-text tickers (Palantir -> PLTR) when AI is rate-limited.
- **Pricing Engine:** `src/lib/market-data.ts` (Waterfall: DexScreener -> CoinGecko -> Yahoo Finance)
- **Charts:** `recharts` library in `src/components/charts/`

## 🆕 Recent Features (Jan 2026)

1. **Charts Section** (`/stats` page)
   - Platform stats dashboard with pie/bar charts
   - Win rate trends, sentiment distribution
   - Top 5 tracked tickers with win rates

2. **AsterDex Monetization**
   - Referral banners on `/recent`, `/leaderboard`, `/stats`
   - Footer sponsorship link
   - Affiliate URL: `asterdex.com/en/referral/48b50b`

3. **Most Tracked Tickers** (`/api/metrics`)
   - BTC (137 calls), ETH (53), SOL (27), ASTER (21), HYPE (17)
   - Includes sentiment split and win rate per ticker

4. **Leaderboard Updates**
   - Minimum 5 calls required (was 3)
   - Bar chart visualization

## 📂 Key Files

| File | Purpose |
|------|---------|
| `src/app/api/metrics/route.ts` | Platform metrics + topTickers |
| `src/app/stats/page.tsx` | Stats dashboard page |
| `src/components/charts/` | Chart components (recharts) |
| `src/components/asterdex-banner.tsx` | Affiliate banner |
| `src/lib/price-refresher.ts` | Ticker price update logic |
| `videos/` | Remotion video project (not in git) |

## 🛠️ Admin Scripts

| Script | Purpose |
|--------|-------|
| `sync-to-local.ts` | **MOST IMPORTANT:** Clones Prod to Local. Run after ANY prod change. |
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
