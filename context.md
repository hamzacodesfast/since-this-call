# 🧠 Agent Handoff Context

**Project:** SinceThisCall (STC) - "Call Receipts for Crypto/Meme Twitter"  
**Current Status:** Production (Main Branch)  
**Last Updated:** January 21, 2026  

---

## 🏗️ Core Architecture

- **Framework:** Next.js 14 (App Router) + TypeScript + TailwindCSS
- **Database:** Upstash Redis (REST API), handled in `src/lib/analysis-store.ts`
- **AI Engine:** `src/lib/ai-extractor.ts` using Gemini 2.0 Flash Exp
    - **Logic:** Extracts Symbol + Sentiment (Bullish/Bearish) + Contract Address (CA)
    - **Key Features:** 
        - Detects "Doomposting" (e.g. "cleanse", "capitulation") as BEARISH
        - Distinguishes between price description vs actual trading position
        - "Chart looks horrible but I'm holding" = BULLISH (not bearish)
- **Pricing Engine:** `src/lib/market-data.ts` (The "Waterfalls" Logic)
    1. **Symbol Cleanup:** Strips `$` prefix and `USDT`/`USD`/`PERP` suffixes
    2. **Pre-Market Check:** `LAUNCH_DATES` (e.g. BTC 2009 launch date logic)
    3. **Yahoo Finance:** Priority for Stocks & Major Crypto
        - **Index Fallbacks:** SPX→SPY, NQ→QQQ, DJI→DIA, VIX→VIXY
    4. **CoinGecko:** PRIMARY for Historical Data & broad coverage
    5. **DexScreener:** Fallback for obscure Meme Coins (SOL/Base)
    6. **GeckoTerminal:** Fallback for DexScreener precision

## 🔄 Live Price Refresh Architecture

**Ticker-Centric Refresh System** (optimized in Jan 2026):

```
tracked_tickers (Set)       → Global list of unique tickers
ticker_index:{tickerKey}    → Maps ticker → list of user:tweetId refs
```

1. **Refresher:** `src/lib/price-refresher.ts` called by `/api/cron/refresh`
2. **Batching:**
    - **CoinGecko:** Up to 50 symbols per call
    - **Yahoo Finance:** Parallel fetches for Stocks
    - **DexScreener:** Up to 30 CAs per call
3. **Trigger:** Vercel Cron (every 15m)
4. **Flow:** Fetch unique tickers → Batch price lookups → Update analyses → Recalculate profiles

## 🛠️ Admin Tools

### Re-analyze Script (`scripts/reanalyze.ts`)
Re-process a tweet to fix incorrect data without manual deletion:
```bash
npx tsx scripts/reanalyze.ts <TWEET_ID> [CA_OVERRIDE]
```
**What it does:**
- Finds tweet in user history
- Re-runs full analysis pipeline
- Updates `user:history`, `recent_analyses`
- Recalculates user profile stats/badges
- Updates ticker tracking

### Other Admin Scripts
| Script | Purpose |
|--------|---------|
| `scripts/remove-tweet.ts` | Remove a single analysis |
| `scripts/remove-multiple.ts` | Remove multiple analyses |
| `scripts/cleanup-duplicates.ts` | Remove duplicate entries in recent_analyses |
| `scripts/sync-profile.ts` | Recalculate user profile from history |
| `scripts/backfill-tickers.ts` | Rebuild ticker index from all analyses |
| `scripts/fix-classification.ts` | Fix CRYPTO/STOCK misclassification |
| `scripts/backup-data.ts` | Export all Redis data |

## 🔧 Recent Fixes (CRITICAL - DO NOT BREAK)

1. **Symbol Cleanup in Analyzer:**
   - `cleanSymbol()` in `analyzer.ts` strips `$` and `USDT`/`USD`/`PERP` suffixes
   - Ensures display shows `HYPE` not `HYPEUSDT`

2. **Duplicate Prevention:**
   - `addAnalysis()` now deduplicates by tweet ID before inserting
   - Prevents same tweet from appearing multiple times in recent list

3. **AI Sentiment Accuracy:**
   - Prompt distinguishes between "describing bad chart" vs "bearish position"
   - "Chart looks horrible but holding" → BULLISH

4. **Index Fallbacks:**
   - SPX/NQ/DJI automatically fallback to SPY/QQQ/DIA if Yahoo fails

5. **Fake Token Prevention:**
   - Known tokens (HYPE, ME, PUMP) bypass DexScreener search
   - Forced stock list in `analyzer.ts` prevents misclassification

## 📂 Key Files

| File | Purpose |
|------|---------|
| `src/lib/market-data.ts` | Price fetching (Yahoo, CoinGecko, DexScreener) |
| `src/lib/price-refresher.ts` | Batch price update engine |
| `src/lib/analyzer.ts` | Main analysis orchestrator |
| `src/lib/ai-extractor.ts` | AI prompt + extraction logic |
| `src/lib/analysis-store.ts` | Redis operations + ticker tracking |
| `src/app/api/cron/refresh/route.ts` | Vercel Cron endpoint |
| `src/app/page.tsx` | Main analysis UI |
| `src/app/user/[username]/page.tsx` | Profile Page + Disqus comments |
| `src/app/leaderboard/page.tsx` | Top/Bottom 10 gurus |

## 🚨 Known Issues / TODOs

1. **Browser Caching:** Homepage caches results in localStorage for 5 mins
2. **Rate Limits:** CoinGecko free tier may hit limits under heavy load
3. **DexScreener History:** Limited for tokens >24h old not on CG/CMC

## 📜 Standard Procedures

### Wrong Analysis Fix
1. Run `scripts/reanalyze.ts <TWEET_ID>` to correct data
2. If token mapping missing, add to `COINGECKO_IDS` or `INDEX_FALLBACKS`
3. Git commit → Deploy → Verify

### Backups
```bash
npx tsx scripts/backup-data.ts
```

**Good Luck, Agent! 🫡**
