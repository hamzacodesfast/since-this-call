# 🧠 Agent Handoff Context

**Project:** SinceThisCall (STC) - "Call Receipts for Crypto/Meme Twitter"  
**Current Status:** Production (Main Branch - Hardened)  
**Last Updated:** February 21, 2026  

---

> [!CAUTION]
> **DEVELOPMENT MANDATE**: Do NOT use Moltbot for any development, coding, or data tasks. Use **Antigravity** and its models strictly.


## 🛑 HARD RULES (FOR AGENTS)
1. **PUSH TO MAIN FIRST**: All logic/code changes MUST be committed and pushed to `main` before any other actions.
2. **SYNC-TO-LOCAL**: Run `npx tsx scripts/sync-to-local.ts` after any push to ensure your local environment reflects the live production data.
3. **NO REDIS TYPE OVERWRITES**: Never overwrite a Hash (`user:profile`) with a String. Use `AnalysisStore` abstractions.
4. **MARKETING ON MAIN**: Always prepare tweets and marketing content using **Production** stats (Main database). Never use local data for public performance reports.
5. **LEADERBOARD THRESHOLD**: Strictly **20 calls minimum** for leaderboard eligibility.

---

## 📊 Current Metrics (Feb 21, 2026 - Live Snapshot)

| Metric | Value |
|--------|-------|
| Total Analyses | 6,500+ |
| Unique Gurus | 1,890+ |
| Tracked Tickers | 550+ |
| Platform Win Rate| ~44.5% (Weighted) |
| Leaderboard Min Calls| 20 |

---

## 🆕 Recent Features (Feb 12-21, 2026)

1.  **AI Extraction Hardening (v2)**
    - **Logic**: Added instructions to ignore "Live Show" noise, handle "$HYPE" style word-tickers, and ensure bearish sentiment on core pairs (like Peter Schiff on $BTC) is never marked NULL.
2.  **Twitter Watcher (Production Ready)**
    - **Location**: `services/twitter-watcher/`
    - **Command**: `npm run watch -- --headless`
    - **Maintenance**: Delete `.chrome-profile` to logout/switch accounts.
3.  **Vercel Build Optimization**
    - Added `.vercelignore` to exclude massive `services/node_modules` and `videos/` from the web deployment.
4.  **Leaderboard Maturity**
    - Minimum qualified calls increased from 15 → 20 to ensure statistics are statistically significant.
5.  **Workspace Consolidation**
    - Purged over 7,000 lines of legacy batch files and redundant debug scripts.
6.  **Stats Engine Repair**
    - `refresh-stats.ts` now correctly calls `recalculate-all-production.ts` to sync the whole production database.

## 📂 Key Files

| File | Purpose |
|------|---------|
| `src/app/api/metrics/route.ts` | Platform metrics + topTickers |
| `src/app/leaderboard/page.tsx` | Leaderboard UI (20-call filter) |
| `src/lib/ai-extractor.ts` | **BATTLE-HARDENED LINGUISTIC ENGINE** |
| `services/twitter-watcher/` | Puppeteer automation service |

## 🛠️ Admin Scripts

| Script | Purpose |
|--------|-------|
| `sync-to-local.ts` | **HARD RULE:** Run after `git pull` or prod check. |
| `recalculate-all-production.ts` | **SYNC EVERYTHING:** Re-calculates all wins/losses/counts for the production DB. |
| `reanalyze.ts` | Fix incorrect analysis for a tweet ID. |
| `bulk-analyze.ts` | Process a JSON list of tweet URLs into the DB. |

## 🎯 Immediate Priorities

1. **Video Automation** - Finalize the Remotion pipeline for "Receipt Videos".
2. **Pro Tier** - Implement Stripe/Subscription logic.
3. **API Access** - Potential external API for other developers to query guru scores.

---

**Good Luck, Agent! 🫡**
