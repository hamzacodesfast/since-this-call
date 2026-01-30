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
1.  **Duplicate Check**: Automatically extracts Tweet ID and Username from input. Skips analyses if the specific tweet ID already exists in that user's history (Production or Local).
2.  **AI Extraction**: Uses Gemini to identify the ticker, sentiment (Bullish/Bearish), and asset type.
3.  **Price Fetching**: Lookups historical price (at tweet time) and current price.
4.  **Performance Calculation**: Calculates % change based on sentiment.
5.  **Storage**: Saves the result to the user's history, global index, and updates their profile stats (win/loss/neutral).
6.  **Rate Limiting**: Waits 2 seconds between tweets to avoid provider throttling.

## 📊 Verification & Maintenance

Once the script completes, you **MUST** flush the metrics cache for the dashboard to update immediately.

1.  **Refresh Global Metrics**:
    The metrics (Total Analyzed, etc.) are cached for 15 minutes. To force an update:
    ```bash
    # Run the flush script (or delete the 'platform_metrics' key in Redis)
    npx tsx scripts/clear-metrics-cache.ts
    ```

2.  **Running on Production**:
    To target the live Production database, pass the Production Redis credentials as environment variables:

    ```bash
    UPSTASH_REDIS_REST_KV_REST_API_URL="<PROD_URL>" \
    UPSTASH_REDIS_REST_KV_REST_API_TOKEN="<PROD_TOKEN>" \
    npx tsx scripts/bulk-analyze.ts tweets_to_analyze.json
    ```

3.  **Check the Leaderboard**:
    Verify if the new calls have moved the needle for any Gurus:
    [Leaderboard](/leaderboard)

## ⚠️ Troubleshooting

- **"Could not identify financial call"**: The AI determined the tweet wasn't a clear BUY/SELL signal.
- **"Market data not found"**: The ticker is too new or symbol is ambiguous. Try adding a `contractAddress` to the input if it's a new meme coin.
- **429 Errors**: Too many requests. The script handles retries, but if it persists, increase the `wait(2000)` delay in `bulk-analyze.ts`.
