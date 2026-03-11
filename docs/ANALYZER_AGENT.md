# 🤖 Analyzer Agent Workflow

This document outlines how to use the **Bulk Analysis Engine** to process lists of scanned tweets and generate financial receipts.

## 🏁 Current Status (as of Mar 11, 2026 - Session 57 Final ✅)
- **Total Calls**: **23,864** (Database reality: **26,279**).
- **Unique Gurus**: 6,098.
- **Win Rate**: 54% 📈.
- **Tracked Assets**: 1,217.

## ⚡ Session Optimizations (Session 34 Updates)
The system has been significantly hardened for scale:
1.  **Global Duplicate Check (Session 57)**: `bulk-analyze.ts` now checks the *entire* 26k+ global history instead of just the last 50 items. This prevents redundant re-analysis costs.
2.  **5x Parallel Processing**: `bulk-analyze.ts` now uses concurrency of 5, reducing batch processing time by ~80%.
3.  **Major Indices Caching**: 5-minute singleton cache for BTC/ETH/SOL prices in `market-data.ts`.
4.  **Active Price Caching**: 60-second in-memory cache for all current price lookups. 
5.  **Auto-Normalization**: Enhanced dominance parsing (e.g., Bearish $USDT.D is auto-converted to Bullish $BTC).
6.  **Pricing Integrity**: Forced `CRYPTO` type for BTC/ETH/SOL to prevent Grayscale Mini Trust ETF collisions ($30 vs $68k).

## ⏭️ Next Session Tasks (FOR THE NEXT AGENT)
1.  **Sync Production**: `npx tsx scripts/sync-to-local.ts`
2.  **Generate Next Batch**: Extract URLs from `services/twitter-watcher/detected-calls.json`:
    ```bash
    grep -oP '"url":\s*"\K[^"]+' services/twitter-watcher/detected-calls.json | \
      awk 'BEGIN{print "["} {if(NR>1)printf(",\n"); printf("  \"%s\"",$0)} END{print "\n]"}' > session58_batch.json
    ```
3.  **Process New Batch**: Run the generated batch file through bulk analysis (`npx tsx scripts/bulk-analyze.ts session58_batch.json`).
4.  **Verify Metrics**: After processing, ensure the Win Rate holds steady near 43-55%.

## 🗃️ Milestone Log
- **Session 30**: 1,400 tweets processed. Crossed 10,000 total calls. 🚀
- **Session 31**: 1,592 tweets processed. Crossed 3,000 unique gurus. 🎯
- **Session 32/33**: Win Rate reached and sustained at **50%**. 🏆
- **Session 34**: System cleanup and optimization update. Fresh batch `session35_batch.json` (1,155 tweets) ready for next session.
- **Session 35**: 19,499 tweets processed (9 batches) → 3,509 net new calls. Total calls: 14,125. Unique gurus: 4,052. Win rate: **38%**. 880 tracked assets.
- **Session 36**: 573 tweets processed -> 995 net new calls. Total calls: 15,120. Unique gurus: 4,264. Win rate: **55%**. 915 tracked assets.
- **Session 37**: 860 tweets processed. Total calls: 15,549. Unique gurus: 4,353. Win rate: **53%**. 939 tracked assets.
- **Session 38**: 917 tweets processed. Total calls: 15,868. Unique gurus: 4,440. Win rate: **47%**. 951 tracked assets.
- **Session 39**: 709 tweets processed. Total calls: 16,019. Unique gurus: 4,474. Win rate: **47%**. 961 tracked assets.
- **Session 40**: 1,769 tweets processed -> 866 net new calls. Total calls: 16,885. Unique gurus: 4,632. Win rate: **40%**. 987 tracked assets.
- **Session 41**: 3,698 tweets processed → 395 net new calls. Total calls: 17,280. Unique gurus: 4,743. Win rate: **43%**. 984 tracked assets.
- **Session 42**: 934 tweets processed → 347 net new calls. Total calls: 17,627. Unique gurus: 4,863. Win rate: **42%**. 1,001 tracked assets.
- **Session 43**: 1,605 tweets processed → 415 net new calls. Total calls: 18,042. Unique gurus: 4,950. Win rate: **42%**. 1,014 tracked assets.
- **Session 44**: 2,387 tweets processed → 462 net new calls. Total calls: 18,504. Unique gurus: 5,051. Win rate: **54%**. 1,037 tracked assets.
- **Session 45**: 2,899 tweets processed → 463 net new calls. Total calls: 18,967. Unique gurus: 5,106. Win rate: **49%**. 1,046 tracked assets.
- **Session 46**: 3,564 tweets processed → 394 net new calls. Total calls: 19,361. Unique gurus: 5,184. Win rate: **51%**. 1,063 tracked assets.
- **Session 47**: 4,456 tweets processed → 1,078 net new calls. Total calls: 20,439. Unique gurus: 5,293. Win rate: **62%**. 1,086 tracked assets.
- **Session 48**: 4,774 tweets processed → 27 net new calls. Total calls: 20,466. Unique gurus: 5,338. Win rate: **61%**. 1,096 tracked assets.
- **Session 49**: 1,238 tweets processed → 783 new calls. Total calls: 20,115. Unique gurus: 5,481. Win rate: **56%**. 1,100 tracked assets.
- **Session 50**: 1,682 tweets processed → 387 new calls. Total calls: 20,502. Unique gurus: 5,536. Win rate: **54%**. 1,112 tracked assets.
- **Session 51**: 2,492 tweets processed → 574 new calls. Total calls: 21,076. Unique gurus: 5,615. Win rate: **46%**. 1,128 tracked assets.
- **Session 52/53**: 3,962 tweets processed → 891 new calls. Total calls: 21,967. Unique gurus: 5,814. Win rate: **37%**. 1,163 tracked assets.
- **Session 54**: 5,047 tweets processed → 734 new calls. Total calls: 22,701. Unique gurus: 5,936. Win rate: **50%**. 1,188 tracked assets.
- **Session 55**: 587 tweets processed → 849 net new calls. Total calls: 23,550. Unique gurus: 6,061. Win rate: **55%**. 1,209 tracked assets.
- **Session 56**: 999 tweets processed → 282 net new calls. Total calls: 23,832. Unique gurus: 6,093. Win rate: **54%**. 1,215 tracked assets.
- **Session 57**: 1,029 tweets processed (697 skips) → 32 net new calls. Total calls: 23,864. **Hardened Duplicate Check implemented.**



## 🛠 Prerequisites

1.  **Local Redis**: Ensure the local Redis container is running.
    ```bash
    docker start redis-local
    # Sync with production before starting
    npx tsx scripts/sync-to-local.ts
    ```
2.  **Environment**: Ensure `.env.local` (Gemini Keys) and `.env.production` (Upstash Keys) are present.
3.  **Vercel Build**: Note that `.vercelignore` excludes non-web folders from build to prevent errors.

## 📥 Input Format

Create a JSON file (e.g., `to_analyze.json`) with a list of Tweet URLs.

```json
[
  "https://x.com/username/status/1234567890",
  "https://x.com/username/status/0987654321"
]
```

## 🚀 Execution Workflow

### A. Bulk Analysis (Preferred)

Run the bulk analysis script to process a batch and auto-sync.

```bash
npx tsx scripts/bulk-analyze.ts to_analyze.json
```

**What it does automatically:**
1.  **Duplicate Check**: Skips tweets already in the history.
2.  **AI Extraction**: Uses Gemini-2.0-flash with high-accuracy prompts.
3.  **Storage**: Saves to Production via `AnalysisStore`.
4.  **Auto-Sync**: Pulls the results back to your local environment.

### B. Single Tweet Fixes / Re-analysis

Use `scripts/reanalyze.ts` for fine-tuning specific inaccurate results.

```bash
# Force a specific symbol
npx tsx scripts/reanalyze.ts <TWEET_ID> --symbol=BTC

# Force a specific action
npx tsx scripts/reanalyze.ts <TWEET_ID> --action=SELL
```

## 📊 Maintenance Scripts

| Script | Purpose |
| :--- | :--- |
| `scripts/recalculate-all-production.ts` | **THE BIG FIX**: Re-runs win/loss/count logic for every user in the DB. |
| `scripts/refresh-stats.ts` | A "Master Refresh" that triggers prices, recalculations, and metrics in sequence. |
| `scripts/sync-to-local.ts` | Clones production Redis data to local Redis. |
| `scripts/list-twitter-links.ts` | Exports all tracked analyst Twitter links to `docs/twitter_profiles.txt`. |

## ⚠️ Common Pitfalls

- **20-Call Filter**: If you add a new analyst, they won't appear on the leaderboard until they hit **20 calls**.
- **Chrome Sessions**: If the Watcher fails, delete `services/twitter-watcher/.chrome-profile` to reset the login session.
- **Vercel Build Errors**: If a "Puppeteer not found" error appears during deployment, it's usually because `.vercelignore` was modified or a top-level file is importing from the `services/` folder.
- **Pricing Collisions**: Major cryptos (BTC, ETH, SOL) are guarded against ETF collisions. If a price looks wildly low ($30 for BTC), check `market-data.ts` forcing logic.
- **AI Hallucinations (Sentiment)**: For Peter Schiff, the AI is instructed to never "inverse" him despite his perma-bear track record. We want HIS intent.
