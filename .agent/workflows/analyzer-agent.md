# 🤖 Analyzer Agent Workflow

This document outlines how to use the **Bulk Analysis Engine** to process lists of scanned tweets and generate financial receipts.

## 🛠 Prerequisites

1.  **Local Redis**: Ensure the local Redis container and proxy are running.
    ```bash
    docker start redis-local
    npx tsx scripts/local-redis-proxy.ts
    # In another terminal:
    npx tsx scripts/test-local-redis.ts
    ```
2.  **Environment**: Ensure `.env.local` contains valid API keys for Gemini (AI Extraction) and market data providers.

## 📥 Input Format

Create a JSON file (e.g., `tweets_to_analyze.json`) with a list of Tweet IDs or URLs.

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

## 🚀 Execution

Run the bulk analysis script pointing to your input file:

```bash
npx tsx scripts/bulk-analyze.ts tweets_to_analyze.json
```

### What happens during execution:
1.  **Duplicate Check**: Skips tweets already present in the user's history.
2.  **AI Extraction**: Uses Gemini to identify the ticker, sentiment (Bullish/Bearish), and asset type.
3.  **Price Fetching**: Lookups historical price (at tweet time) and current price.
4.  **Performance Calculation**: Calculates % change based on sentiment.
5.  **Storage**: Saves the result to the user's history, global index, and updates their profile stats (win/loss/neutral).
6.  **Rate Limiting**: Waits 2 seconds between tweets to avoid provider throttling.

## 📊 Verification & Maintenance

Once the script completes, you should sync the data or refresh the global metrics:

1.  **Refresh Global Metrics**:
    ```bash
    npx tsx scripts/refresh-metrics.ts
    ```
2.  **Sync to Production (Optional)**:
    If you analyzed on local and want to push to prod, use the appropriate sync direction (standard is prod -> local, so be careful). Typically, you should run bulk-analyze directly on production using `.env.production`.

    ```bash
    # To run on production
    NODE_ENV=production npx tsx scripts/bulk-analyze.ts tweets_to_analyze.json
    ```

3.  **Check the Leaderboard**:
    Verify if the new calls have moved the needle for any Gurus:
    [Leaderboard](/leaderboard)

## ⚠️ Troubleshooting

- **"Could not identify financial call"**: The AI determined the tweet wasn't a clear BUY/SELL signal.
- **"Market data not found"**: The ticker is too new or symbol is ambiguous. Try adding a `contractAddress` to the input if it's a new meme coin.
- **429 Errors**: Too many requests. The script handles retries, but if it persists, increase the `wait(2000)` delay in `bulk-analyze.ts`.
