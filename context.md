# 🧠 Agent Handoff Context

**Project:** SinceThisCall (STC) - "Call Receipts for Crypto/Meme Twitter"  
**Current Status:** Production (Main Branch)  
**Last Updated:** January 23, 2026  

---

## 📊 Current Metrics (Jan 23, 2026)

| Metric | Value |
|--------|-------|
| Tracked Calls | 530 |
| Unique Gurus | 291 |
| Unique Tickers | 131 |
| Platform Win Rate | 38% |
| Twitter Followers | ~146 |
| Website MAU | 71 |

---

## 🏗️ Core Architecture

- **Framework:** Next.js 14 (App Router) + TypeScript + TailwindCSS
- **Database:** Upstash Redis (REST API), handled in `src/lib/analysis-store.ts`
  - **Schema Enforced:** `user:profile:*` (Hash), `user:history:*` (List), `all_users` (Set).
  - **Critical Rule:** Never overwrite a Hash with a String. use `hset`, not `set`.
- **AI Engine:** `src/lib/ai-extractor.ts` using Gemini 2.0 Flash Exp
- **Pricing Engine:** `src/lib/market-data.ts` (Waterfall: Yahoo → CoinGecko → DexScreener)
- **Charts:** `recharts` library in `src/components/charts/`
- **Monitoring:** Vercel Speed Insights

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
|--------|---------|
| `reanalyze.ts` | Fix incorrect analysis |
| `refresh-metrics.ts` | Manually refresh stats cache |
| `remove-tweet.ts` | Delete single analysis |
| `sync-profile.ts` | Recalculate user stats |
| `backup-data.ts` | Export all Redis data |

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
