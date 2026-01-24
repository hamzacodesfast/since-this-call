# 🤖 Agent Rules & Protocols (SinceThisCall)

## 🛑 THE HARD RULES
1. **PUSH TO MAIN FIRST**: Any logic changes to `ai-extractor.ts`, `market-data.ts`, or scripts MUST be committed and pushed to the `main` branch before proceeding with database refreshes or production syncs.
2. **SYNC-TO-LOCAL PROTOCOL**: Immediately after a `git pull` or `git push`, run:
   ```bash
   npx tsx scripts/sync-to-local.ts
   ```
   This ensures your local analysis results match what the user sees on production.
3. **REDIS INTEGRITY**: Never use `SET` on a key that is a Hash (like `user:profile:*`). Overwriting a hash with a string will break the frontend. Use the `AnalysisStore` in `src/lib/analysis-store.ts`.

## 🧠 CONTEXT ENGINE CAPABILITIES
The AI Extraction engine (`src/lib/ai-extractor.ts`) is battle-hardened with 101+ verified cases. When refining logic:
- **Prioritize Logic Over Chart**: If the user uses slang like "Cooked", "Survive", or "Avoiding", the action is **SELL** regardless of what the chart looks like.
- **Math Matters**: The engine must perform price comparisons. If Target < Current, it is BEARISH.
- **Proxy Tickers**:
  - Official `@Strategy` or `@saylor` buys = **BTC** ticker (not MSTR).
  - USDT Dominance (`USDT.D`) Bearish = **Bullish** for the broader market.

## 🛠️ VERIFICATION WORKFLOW
When adding new edge cases:
1. Update `ai-extractor.ts` prompt.
2. Run `npx tsx scripts/reanalyze.ts <ID>` to verify.
3. If successful, add the case to `walkthrough.md`.
4. Once verified, **Push to main** then **Sync to Production**.

---
*Updated: Jan 24, 2026*
