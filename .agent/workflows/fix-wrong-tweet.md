---
description: How to fix a tweet with wrong pricing data
---

# Fix Wrong Tweet Pricing

When a user reports incorrect pricing on a tweet analysis, follow these steps:

## 1. Identify the Issue

Check what's wrong:
- Entry price incorrect?
- Current price incorrect?
- Wrong token entirely?

## 2. Debug the Source

```bash
# Check what DexScreener returns for the symbol
curl -s "https://api.dexscreener.com/latest/dex/search?q=SYMBOL" | jq '[.pairs[] | select(.baseToken.symbol == "SYMBOL")] | sort_by(-(.liquidity.usd // 0)) | .[0:3] | .[] | {name: .baseToken.name, price: .priceUsd, liquidity: .liquidity.usd}'

# Check CoinGecko price
curl -s "https://api.coingecko.com/api/v3/simple/price?ids=TOKEN_ID&vs_currencies=usd"
```

// turbo
## 3. Fix the Token Mapping (if needed)

If it's a fake token issue:
1. Add to `KNOWN_CAS` in `src/lib/market-data.ts`
2. Add to `COINGECKO_IDS` in `src/lib/market-data.ts`
3. Add to `COINGECKO_SYMBOLS` in `src/lib/analyzer.ts`

## 4. Remove Bad Analysis from Redis

```bash
# Find the tweet ID
npx tsx -e "
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL, token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN });
async function find() {
    const list = await redis.lrange('recent_analyses', 0, -1);
    for (const item of list) {
        const p = typeof item === 'string' ? JSON.parse(item) : item;
        if (p.symbol === 'SYMBOL' || p.username?.toLowerCase() === 'username') {
            console.log('Found:', p.id, p.symbol, p.username, 'Entry:', p.entryPrice);
        }
    }
}
find();
"

# Remove by tweet ID
npx tsx -e "
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL, token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN });
const TWEET_ID = 'REPLACE_WITH_TWEET_ID';
const USERNAME = 'REPLACE_WITH_USERNAME';
async function remove(key, id) {
    const list = await redis.lrange(key, 0, -1);
    const filtered = list.filter(item => { const p = typeof item === 'string' ? JSON.parse(item) : item; return p.id !== id; });
    if (filtered.length < list.length) {
        await redis.del(key);
        for (let i = filtered.length - 1; i >= 0; i--) { await redis.lpush(key, typeof filtered[i] === 'string' ? filtered[i] : JSON.stringify(filtered[i])); }
        console.log('Removed from', key);
    }
}
async function main() { await remove('recent_analyses', TWEET_ID); await remove('user:history:' + USERNAME, TWEET_ID); console.log('Done'); }
main();
"
```

## 5. Re-analyze the Tweet

```bash
curl "http://localhost:3000/api/analyze?url=TWEET_URL" | jq
```

// turbo
## 6. Commit and Push

```bash
git add -A && git commit -m "fix: Add TOKEN to known tokens/CoinGecko mapping" && git push origin main
```

// turbo
## 7. Refresh User Stats (optional)

If needed, run the profile refresh:
```bash
npx tsx scripts/backfill-profiles.ts
```
