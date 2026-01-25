# Platform Health Report: January 25, 2026
**Generated:** 2026-01-25T03:30:00Z
**Trigger:** Infrastructure Upgrade (Gemini 2.0 Flash Tier 1 + Pipelined Sync)

## 📊 High-Level Metrics
| Metric | Value | Change (vs. Pre-Fix) |
|--------|-------|--------|
| Total Analyses | 573 | +2 |
| Unique Gurus | 247 | +2 |
| **Global Win Rate** | **40%** | **+1%** |
| Tracked Tickers | 215 | +4 |

## 🛠️ Data Integrity Improvements
Following the migration to **AI-Only Extraction** and **Precise Historical Pricing**, the platform has undergone a full state refresh.

### 1. Linguistic Accuracy
- **Model:** Gemini 2.0 Flash (Stable).
- **Result:** Dramatically reduced false positives in ticker identification and sentiment extraction. 100% of new analyses are processed without regex fallbacks.

### 2. Pricing Fidelity
- **Fix:** Entry prices are now correctly pinned to the `timestamp` of the original tweet.
- **Impact:** Systemic "100% Win Rate" bugs for recent analyses have been eliminated. The 1% increase in global win rate reflects the removal of data noise and the inclusion of deeper historical context for legacy calls.

### 3. Capacity
- **Headroom:** 2,000 RPM (up from 15).
- **Latency:** Sync-to-local now completes in < 2 minutes vs. > 60 minutes.

---
*Report archived in /analytics/reports/2026-01-25-infra-upgrade.md*
