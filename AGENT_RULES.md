# 🚨 CRITICAL AGENT RULES & PROTOCOLS 🚨

## 🛑 THE HARD RULES (Operational Integrity)
1. **PUSH TO MAIN FIRST**: Any logic changes to `ai-extractor.ts`, `market-data.ts`, or scripts MUST be committed and pushed to the `main` branch before proceeding with database refreshes or production syncs.
2. **SYNC-TO-LOCAL PROTOCOL**: Immediately after a `git pull` or `git push`, run `npx tsx scripts/sync-to-local.ts` to ensuring parity.
3. **MARKETING ON MAIN**: Always prepare tweets and marketing content using **Production** stats. Local data is for development only.
4. **REDIS INTEGRITY**: 
    - Never use `SET` on a key that is a Hash (like `user:profile:*`). Overwriting a hash with a string will break the frontend.
    - Never run `FLUSHDB` indiscriminately.
    - Always respect strict types: `user:history:*` (List), `all_users` (Set).

## 🧠 CONTEXT ENGINE & AI PROTOCOLS
The AI Extraction engine (`src/lib/ai-extractor.ts`) is battle-hardened. When refining logic:
- **Models**: Use `gemini-2.0-flash` (standard) for production capacity (2,000 RPM). Avoid `experimental` models unless testing.
- **Asset Type Selection**: Honor the `typeOverride` (CRYPTO or STOCK) passed by the UI.
- **Linguistic Logic**:
  - Slang like "Cooked", "Surviving", "Avoiding" = **SELL/BEARISH**.
  - **Math Matters**: If Target Price < Current Price = BEARISH.
  - **Proxy Tickers**: `@Strategy` / `@saylor` BUYS = **BTC**. `USDT.D` BEARISH = Market BULLISH.
- **Capacity Handling**: If the API hits a 429, the system throws a specific "At Capacity" error. Do NOT fall back to regex.

## 🛠️ VERIFICATION & DEPLOYMENT
1. **Verify**: Use `scripts/test-context-engine.ts` or `reanalyze.ts` to test logic changes.
2. **Push**: Commit to `main` (`git push origin main`).
3. **Sync**: Run `npx tsx scripts/sync-to-local.ts` to update your dev environment.
4. **Refresh**: Run `npx tsx scripts/refresh-metrics.ts` to update the homepage stats.

---
**Core Philosophy:** Trust Nothing (Input/Clients), Verify Everything (Data/Code).
