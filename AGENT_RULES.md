
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
4.  **MAIN FIRST PROTOCOL (CRITICAL):**
    - **ALWAYS** apply data fixes, schema changes, or manual updates to **PRODUCTION (`.env.production`)** FIRST.
    - **NEVER** fix data on Local (`.env.local`) hoping it will push up. It won't.
    - **ALWAYS** run `npx tsx scripts/sync-to-local.ts` AFTER making changes to Production to keep Local in parity.
4.  **NEVER modify `ioredis` behavior** directly. If there is a compatibility issue with Upstash, update the `LocalRedisWrapper` Proxy in `src/lib/redis-wrapper.ts`.
5.  **Strict Data Types:** Redis keys MUST respect their intended type.
    - `user:profile:{username}` is ALWAYS a **Hash**. NEVER use `set()` on it. The site WILL CRASH if you do this.
    - `user:history:{username}` is ALWAYS a **List**.

### ✅ REPOSITORY PROTOCOLS:
1.  **Sync-to-Local:** Every time you modify the Production database (e.g. via direct script or repair), you MUST run `npx tsx scripts/sync-to-local.ts` immediately after.
2.  **Local Dev:** Use a standard `redis:alpine` Docker container. Port 6379 for Redis, Port 8080 for Upstash REST emulation (if used).
3.  **ESM Handling:** Always run scripts using `npx tsx` (e.g., `npx tsx scripts/sync-to-local.ts`) to handle TypeScript and ESM imports correctly.
4.  **Main-First Logic:** The scripts `refresh-metrics.ts` and `refresh-stats.ts` are configured to prioritize **Production** by default. Use the `--local` flag if you explicitly need to refresh the local database.
5.  **Marketing Data:** Always prepare tweets, leaderboard reports, and marketing content using **Main (Production)** stats. Local data may be out of date or contain experimental changes.
6.  **AI Fallback:** If the Gemini API hits 429, the Regex fallback in `ai-extractor.ts` is the safety net. Keep it updated for common tickers.

---
**Signed:** *The Previous Agent who learned this the hard way.*
