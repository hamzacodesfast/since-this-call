# 🤖 Analyzer Agent Workflow

This document outlines how to use the **Bulk Analysis Engine** to process lists of scanned tweets and generate financial receipts.

## 🏁 Current Status (as of Feb 12, 2026 - Expanding Reach)
- **Latest Batch**: Session 11 (361 tweets) processed.
- **Total Calls**: **6,525** (Steadily approaching 7k).
- **Unique Gurus**: 1,770.
- **Win Rate**: 40%.
- **Automation**: Post-analysis sync and metrics refresh are now fully integrated into the bulk script.

## 🛠 Prerequisites

1.  **Local Redis**: Ensure the local Redis container and proxy are running.
    ```bash
    docker start redis-local
    npx tsx scripts/local-redis-proxy.ts
    # In another terminal:
    npx tsx scripts/test-local-redis.ts
    ```
2.  **Environment**: Ensure `.env.local` contains valid API keys for Gemini (AI Extraction) and market data providers.
3.  **Production Access**: Ensure `.env.production` is present for direct production analysis/refresh.

## 📥 Input Format

Create a JSON file (e.g., `new_batch.json`) with a list of Tweet IDs or URLs.

**Option A: Simple Array of Strings**
```json
[
  "https://x.com/username/status/1234567890",
  "18838382929292"
]
```

**Option B: Detailed Object (Recommended for Scanners)**
```json
{
  "calls": [
    { "id": "18838382929292", "username": "investor_zero" },
    { "id": "18838382929293", "username": "alpha_seeker" }
  ]
}
```

## 🚀 Execution Workflow

### A. Bulk Analysis (Preferred)

Run the bulk analysis script. This script is **self-healing** and performs post-analysis syncs automatically.

```bash
npx tsx scripts/bulk-analyze.ts new_batch.json
```

**What it does automatically:**
1.  **Duplicate Check**: Skips tweets already in the history.
2.  **AI Extraction**: Uses Gemini-2.0-flash to identify calls.
3.  **Storage**: Saves to Production (or Local depending on ENV).
4.  **Production Refresh**: Triggers `refresh-metrics.ts` on the production server.
5.  **Auto-Sync**: Pulls the latest production data to your local Redis via `sync-to-local.ts`.
6.  **Local Refresh**: Rebuilds local metrics so you can verify changes immediately at `localhost:3000`.

### B. Single Tweet Fixes / Re-analysis

Use `scripts/reanalyze.ts` for fine-tuning specific inaccurate results.

```bash
# Force a specific symbol (useful for ambiguous tickers)
npx tsx scripts/reanalyze.ts <TWEET_ID> --symbol=BTC

# Force a specific action (BUY/SELL)
npx tsx scripts/reanalyze.ts <TWEET_ID> --action=BUY
```

## 📊 Maintenance Scripts

| Script | Purpose |
| :--- | :--- |
| `scripts/refresh-metrics.ts` | Rebuilds the global stats (calls count, win rate). |
| `scripts/sync-to-local.ts` | Clones production Redis data to local Redis. |
| `scripts/clear-metrics-cache.ts` | Wipes the 15-minute dashboard cache. |

## 🎯 Upcoming Goals for the Next Agent

1.  **The 5,000 Call Milestone**: ACHIEVED (5,039 Calls)! Next target: 7,500.
2.  **Guru Diversification**: Aim for gurus with < 5 calls to expand the "Gurus" count towards 1,500.
3.  **Ticker Cleanup**: Identify and re-analyze tweets with "Manual Fix Required" flags in the logs.

## ⚠️ Common Pitfalls

- **Yahoo/CMC Rate Limits**: If prices return null, wait 5 minutes and re-run.
- **Ambiguous Tickers**: AI sometimes mistakes `$ME` for the word "me" or `$BOBO` for nonsense. Use `--symbol` override.
- **Private Tweets**: If a user goes private, the analyzer will fail with "Tweet not found". Skip these.
