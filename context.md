# 🧠 Agent Handoff Context

**Project:** SinceThisCall (STC) - "Call Receipts for Crypto/Meme Twitter"  
**Current Status:** Production (Main Branch)  
**Last Updated:** January 21, 2026  

---

## 🏗️ Core Architecture

- **Framework:** Next.js 14 (App Router) + TypeScript + TailwindCSS
- **Database:** Upstash Redis (REST API), handled in `src/lib/analysis-store.ts`
- **AI Engine:** `src/lib/ai-extractor.ts` using Gemini 2.0 Flash Exp
- **Pricing Engine:** `src/lib/market-data.ts` (Waterfall: Yahoo → CoinGecko → DexScreener)
- **Monitoring:** Vercel Speed Insights (added Jan 21)

## 📊 Metrics System (New)

A platform-wide dashboard on the homepage showing live stats:
- **Endpoint:** `/api/metrics` (Aggregates stats from all user profiles)
- **Caching:** 15-minute Redis cache (`platform_metrics`)
- **UI:** `src/components/metrics-bar.tsx` (Animated counters)
- **Refresh:** Manual via `scripts/refresh-metrics.ts` or Cron

## 🔄 Live Price Refresh Architecture

**Ticker-Centric Refresh System**:
1. **Refresher:** `src/lib/price-refresher.ts` called by `/api/cron/refresh`
2. **Trigger:** Vercel Cron (Daily `0 0 * * *`)
   - **Note:** Vercel Hobby plan limits cron to 1/day. For 15m refresh, use external service targeting `/api/cron/refresh`.

## 🛠️ Admin Tools

### Scripts (`/scripts`)
| Script | Purpose |
|--------|---------|
| `reanalyze.ts` | Fix incorrect analysis (updates history + profile + tickers) |
| `refresh-metrics.ts` | Manually refresh homepage stats cache |
| `remove-tweet.ts` | Delete single analysis |
| `sync-profile.ts` | Recalculate user stats from history |
| `backup-data.ts` | Export all Redis data |

## 🔧 Recent Critical Fixes

1. **Symbol Cleanup:** `cleanSymbol()` strips `$` and `USDT` suffixes (e.g. `HYPEUSDT` -> `HYPE`).
2. **Metrics Dashboard:** Added visual stats bar to homepage.
3. **Speed Insights:** Integrated `@vercel/speed-insights`.
4. **Vercel Deployment:** Fixed cron schedule to daily (`0 0 * * *`) to pass Hobby plan validation.

## 📂 Key Files

| File | Purpose |
|------|---------|
| `src/lib/analysis-store.ts` | Redis layer (Profiles, History, Tickers) |
| `src/app/api/metrics/route.ts` | Metrics aggregation endpoint |
| `src/components/metrics-bar.tsx` | Client component for stats |
| `src/app/layout.tsx` | Global layout + Speed Insights |
| `vercel.json` | Cron configuration |

## 🚨 Known Issues / TODOs

1. **Cron Frequency:** Currently daily due to Vercel Hobby limits. Upgrade to Pro for 15m.
2. **Vercel Deployments:** If auto-deploy fails, use `npx vercel --prod`.

## 📜 Standard Procedures

### Wrong Analysis Fix
`npx tsx scripts/reanalyze.ts <TWEET_ID>`

### Deployment
`npx vercel --prod` (if git push doesn't trigger)

**Good Luck, Agent! 🫡**
