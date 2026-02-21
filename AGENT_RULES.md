# 🚨 CRITICAL AGENT RULES & PROTOCOLS 🚨

## 🛑 THE HARD RULES (Operational Integrity)
1. **PUSH TO MAIN FIRST**: Any logic changes to `ai-extractor.ts`, `market-data.ts`, or scripts MUST be committed and pushed to the `main` branch before proceeding with database refreshes or production syncs.
2. **SYNC-TO-LOCAL PROTOCOL**: Immediately after a `git pull` or `git push`, run `npx tsx scripts/sync-to-local.ts`.
3. **LEADERBOARD THRESHOLD**: **Strictly 20 calls minimum.** This is hardcoded in `src/app/leaderboard/page.tsx` and `scripts/generate-tweets.ts`. Do not lower this without user approval.
4. **VERCEL BUILDS**: Do NOT remove the `.vercelignore`. It is critical for skipping Puppeteer-heavy folders (`services/`) that cause Vercel build timeouts and dependency errors.
5. **REDIS INTEGRITY**: 
    - Never use `SET` on a key that is a Hash (like `user:profile:*`).
    - Respect strict types: `user:history:*` (List), `all_users` (Set).

## 🧠 CONTEXT ENGINE & AI PROTOCOLS
The AI Extraction engine (`src/lib/ai-extractor.ts`) is battle-hardened.
- **Word-Tickers**: `$HYPE` style tickers must be verified by context.
- **Noise Detection**: Ignore "Live Show" / "Space" ads.
- **Sentiment Hardening**: Instructions are included to catch bullish/bearish cases even for repetitive "permabears" (e.g. Schiff).
- **Capacity**: If Gemini returns 429, the system throws an "At Capacity" error. Do NOT fall back to regex.

## 🛠️ VERIFICATION & DEPLOYMENT
1. **Verify**: Use `scripts/reanalyze.ts` to test logic changes against specific tweets.
2. **Push**: Commit to `main` (`git push origin main`).
3. **Recalculate**: If data changes, run `npx tsx scripts/recalculate-all-production.ts` to sync the database.
4. **Refresh**: Run `npx tsx scripts/refresh-metrics.ts` to update the global homepage cache.

---
**Core Philosophy:** Trust Nothing (Input/Clients), Verify Everything (Data/Code).
