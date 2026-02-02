---
description: How to re-analyze an entire user profile to apply AI updates.
---

1.  **Identify the User**
    Determine the exact username (without @) of the profile you want to re-process (e.g. `Alejandro_XBT`).

2.  **Run the Reanalysis Script**
    Execute the profile reanalysis script. This will fetch their tweet history, re-run the AI extraction and market data lookup for every tweet, and update the database in-place.
    
    ```bash
    npx tsx scripts/reanalyze-profile.ts <USERNAME>
    ```
    
    *Optional: Limit the number of tweets to check (e.g. last 10)*
    ```bash
    npx tsx scripts/reanalyze-profile.ts <USERNAME> 10
    ```

3.  **Refresh Metrics**
    After reanalyzing, always refresh the global platform metrics to ensure win rates and leaderboards are synced.
    
    ```bash
    npx tsx scripts/refresh-metrics.ts
    ```

4.  **Verify**
    Check the user's profile page or the recent feed to verify the updates.
