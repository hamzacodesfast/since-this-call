# 🤖 Analyzer Agent Workflow

This document outlines how to use the **Bulk Analysis Engine** to process lists of scanned tweets and generate financial receipts.

## 🏁 Current Status (as of Feb 21, 2026 - Consistency in Scale)
- **Latest Milestone**: **6,500+ Financial Calls** verified across the platform.
- **Guru Pool**: 1,890+ Unique Analysts tracked.
- **Data Hardening**: 
    - **Minimum 20 Calls** required for leaderboard eligibility.
    - **Linguistic Logic**: Hardened against "Noise" (Live Shows/Spaces) and Ambiguous Tickers ($HYPE).
    - **Persistent Sentiment**: Peter Schiff cases ($BTC bear) are correctly classified as SELL.
- **Automation**: Twitter Watcher service is fully operational in `services/twitter-watcher/`.

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
