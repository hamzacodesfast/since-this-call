
# 🚨 CRITICAL AGENT RULES - PLEASE READ 🚨

## Database Integrity Protocol
**DO NOT BREAK THE DATABASE.**

This application relies on a delicate sync between Upstash Redis keys.
- `all_users` (Set): Specific set of usernames tracking performance.
- `user:profile:{username}` (Hash): User statistics.
- `user:history:{username}` (List): Chronological analysis history.
- `tracked_tickers` (Set): Global index of assets.

### 🚫 STRICT PROHIBITIONS:
1.  **NEVER run `FLUSHDB` or `FLUSHALL`.**
2.  **NEVER switch between Local and Production keys mid-task.** Use `.env.local` for Localhouse and `.env.production` for scripts targeting Prod.
3.  **NEVER trust local backup files (e.g., `latest.json`) to be complete.** Always sync from Production.
4.  **NEVER modify `ioredis` behavior** directly. If there is a compatibility issue with Upstash, update the `LocalRedisWrapper` Proxy in `src/lib/redis-wrapper.ts`.
5.  **Strict Data Types:** Redis keys MUST respect their intended type.
    - `user:profile:{username}` is ALWAYS a **Hash**. NEVER use `set()` on it. The site WILL CRASH if you do this.
    - `user:history:{username}` is ALWAYS a **List**.

### ✅ REPOSITORY PROTOCOLS:
1.  **Sync-to-Local:** Every time you modify the Production database (e.g. via direct script or repair), you MUST run `npx tsx scripts/sync-to-local.ts` immediately after.
2.  **Local Dev:** Always ensure `npx tsx scripts/local-redis-proxy.ts` is running in a terminal if you are using the local environment.
3.  **AI Fallback:** If the Gemini API hits 429, the Regex fallback in `ai-extractor.ts` is the safety net. Keep it updated for common tickers.

---
**Signed:** *The Previous Agent who learned this the hard way.*
