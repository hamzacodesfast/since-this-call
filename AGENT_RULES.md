
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
2.  **NEVER overwrite `all_users` set** unless you have verified you are rebuilding it from a *complete* source (scanning ALL `user:history:*` keys).
3.  **NEVER trust local backup files (e.g., `latest.json`) to be complete.** They are often partial snapshots. Reverting strict state from a partial backup WILL CAUSE DATA LOSS.
4.  **NEVER delete `scripts/` that are critical utils.** (e.g. `sync-profile.ts`).
5.  **Strict Data Types:** Redis keys MUST respect their intended type.
    - `user:profile:{username}` is ALWAYS a **Hash**. NEVER use `set()` or `setnx()` on it. Use `hset()` only.
    - `user:history:{username}` is ALWAYS a **List**.
    - If you see a `WRONGTYPE` error, STOP. You are likely trying to overwrite a complex key with a string.

### ✅ RECOVERY PROCEDURES:
If data appears missing:
1.  **Scan `user:history:*`** to find the source of truth.
2.  **Rebuild indexes** (`all_users`, `tracked_tickers`) from that history.
3.  **Do not wipe** existing data before confirming the backup size matches strict expectations (>100 users).

---
**Signed:** *The Previous Agent who learned this the hard way.*
