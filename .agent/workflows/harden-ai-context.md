---
description: How to harden the AI's context by providing examples and rules for specific analysis errors.
---

This workflow defines the loop for fixing AI analysis errors (missed calls, wrong direction, ignored tweets).

1.  **Identify the Error**
    The user or agent identifies a tweet that was incorrectly analyzed.
    *   *Example: "This tweet '60k loading' was ignored but should be BEARISH."*

2.  **Provide Context (User)**
    The user explains the nuance or rule that the AI attempted to miss.
    *   *User: "'Loading' usually implies the price is heading there. If the target is lower, it's bearish."*

3.  **Harden AI Prompt (Agent)**
    The agent updates `src/lib/ai-extractor.ts` to include:
    *   **New Rule**: A description of the pattern (e.g., `LOADING SIGNALS (BEARISH)`).
    *   **Few-Shot Example**: A concrete example of the tweet and the expected logic/result.

4.  **Verify Fix (Agent)**
    The agent re-analyzes the specific tweet using the `reanalyze` script to ensure it now passes.
    
    ```bash
    npx tsx scripts/reanalyze.ts <TWEET_ID>
    ```

5.  **Refresh Metrics**
    Once verified, refresh the platform stats.
    
    ```bash
    npx tsx scripts/refresh-metrics.ts
    ```
