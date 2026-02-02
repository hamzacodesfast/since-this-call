# Professional Resume

## **Senior Software Engineer & AI Architect**
*Building high-fidelity social analytics platforms with Agentic AI workflows.*

---

### **Professional Summary**
Results-driven Engineering Leader with deep expertise in **Full-Stack Development**, **Data Engineering**, and **Applied AI**. Proven track record of architecting and shipping complex production systems, specifically focusing on financial data integrity and social sentiment analysis. Expert in orchestrating "Agentic" workflows to accelerate development velocity while maintaining rigorous code quality and operational stability.

---

### **Technical Skills**
*   **Core Stack:** TypeScript, Next.js 14 (App Router), Node.js, React, TailwindCSS.
*   **Data & Database:** Redis (Upstash & Local), SQL patterns in NoSQL, Data Modeling, ETL Pipelines.
*   **AI & LLMs:** Prompt Engineering, Context Injection, RAG patterns (Market Data + Social Text), Gemini/OpenAI API integration.
*   **DevOps & Infrastructure:** Docker, Vercel, CI/CD pipelines, Environment Synchronization (Prod-to-Local workflows).
*   **Domain Knowledge:** Financial Markets (Crypto/Equities), Sentiment Analysis, Social Graph Analytics.

---

### **Featured Project Experience**

#### **Lead Engineer | Since This Call (Social Prediction Tracker)**
*Jan 2026 – Present*

Architected and built a comprehensive platform to track and score financial predictions ("calls") from "FinTwit" influencers against real market performance.

**Key Achievements:**

*   **AI-Driven Context Engine:**
    *   Designed a linguistic extraction engine using **Gemini 2.0 Flash** to parse slang (e.g., "Cooked", "Send it") into binary Buy/Sell signals.
    *   Implemented "Context Injection" to prevent hallucinations, feeding real-time prices (BTC, SOL) into the model to validate logical directionality of predictions.
    *   Achieved **95%+ accuracy** in sentiment classification across 2,000+ complex financial tweets.

*   **Robust Data Architecture:**
    *   Built a "Dual-Write" database architecture (Hash/List/Set) on **Upstash Redis** to ensure query efficiency and data type safety.
    *   Developed a "Waterfall" pricing engine that resolves assets across multiple providers (**GeckoTerminal, DexScreener, Yahoo Finance**) with fallback logic for contract addresses (CA) and futures indices.
    *   Engineered a seamless **Prod-to-Local Sync** workflow (`sync-to-local.ts`), enabling safe local development against live production datasets.

*   **Full-Stack Feature Delivery:**
    *   Shipped the **Tickers Feature**: A dedicated asset explorer aggregating widespread social sentiment into "Bullish/Bearish" indicators and "Trending" leaderboards (unified logic with platform stats).
    *   Implemented dynamic **Leaderboards** to rank analysts by Win Rate and Total PnL, necessitating complex real-time aggregation of user histories.
    *   Developed automated **Maintenance Scripts** (Backfills, Re-analysis, Price Refreshes) to maintain data integrity for 500+ tracked users and 300+ assets.

*   **Operational Excellence:**
    *   Enforced strict **"Main-First"** development protocols to prevent environment drift.
    *   Authored comprehensive documentation (`SECURITY_HANDBOOK.md`, `Role Guides`) to standardize team workflows and security protocols.
    *   Integrated **Moltbook** and other ecosystem tools to enhance platform reach and credibility.

---

### **Key Competencies Exhibited**

*   **Agentic Orchestration:** Rapidly iterating on complex features by guiding AI agents through Planning, Execution, and Verification phases.
*   **Problem Solving:** Diagnosing and fixing subtle data corruption issues (e.g., "Ghost Calls", "IREN Stock vs Crypto" ambiguity) using surgical repair scripts.
*   **Product Vision:** Defining roadmap priorities (Mobile Polish, Pro Tier) and translating high-level business goals into technical implementation plans.

---
