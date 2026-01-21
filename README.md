# Since This Call 📉📈

**Since This Call** is a "Social Prediction Tracker" that tracks the performance of crypto and stock predictions ("calls") made on X (formerly Twitter).

Paste a tweet URL, and the app will tell you exactly how that asset has performed since the moment the tweet was posted.

![Cramer Badge Example](public/cramer.png)

## ✨ Features

- **AI-Powered Extraction**: Uses **Google Gemini 2.0 Flash** to intelligently parse tweets, identifying asset symbols, sentiment (Bullish/Bearish), and prediction dates
- **Live Price Updates**: Automatic 15-minute price refresh via Vercel Cron keeps call receipts accurate
- **Multi-Asset Support**:
  - **Crypto**: Real-time prices via **CoinGecko** & **DexScreener** (Meme coins supported!)
  - **Stocks & ETFs**: Free data via **Yahoo Finance**
  - **Index Fallbacks**: Automatically resolves SPX→SPY, NQ→QQQ, DJI→DIA
- **Leaderboard**: Track the top (and worst) financial gurus with win/loss records
- **Profile Pages**: Individual pages for each guru with full prediction history
- **Community Comments**: Disqus integration for discussion on each profile
- **Social Sharing**: One-click visual sharing generates a screenshot of the analysis
- **Premium UI**: Sleek dark-mode design with Tailwind CSS and shadcn/ui

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Database | [Upstash Redis](https://upstash.com/) (Serverless) |
| AI | [Vercel AI SDK](https://sdk.vercel.ai/) + [Google Gemini](https://ai.google.dev/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| Comments | [Disqus](https://disqus.com/) |

### Data Sources
- **Yahoo Finance** - Stocks, ETFs, Indices
- **CoinGecko** - Major crypto (50+ tokens mapped)
- **DexScreener** - Meme coins, Solana/Base tokens
- **GeckoTerminal** - Historical precision for DEX tokens

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Google Gemini API Key (Free)
- Upstash Redis account (Free tier available)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/hamzacodesfast/since-this-call.git
   cd since-this-call
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   ```bash
   cp .env.example .env.local
   ```
   
   Add your keys to `.env.local`:
   ```env
   # Required
   GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
   UPSTASH_REDIS_REST_KV_REST_API_URL=your_upstash_url
   UPSTASH_REDIS_REST_KV_REST_API_TOKEN=your_upstash_token
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```

5. **Open the App:**
   Visit `http://localhost:3000`

## 🧰 Admin Scripts

Located in `/scripts`, these help manage and correct data:

| Script | Usage | Purpose |
|--------|-------|---------|
| `reanalyze.ts` | `npx tsx scripts/reanalyze.ts <TWEET_ID>` | Re-analyze a tweet to fix incorrect data |
| `remove-tweet.ts` | `npx tsx scripts/remove-tweet.ts <TWEET_ID>` | Remove a single analysis |
| `cleanup-duplicates.ts` | `npx tsx scripts/cleanup-duplicates.ts` | Remove duplicate entries |
| `sync-profile.ts` | `npx tsx scripts/sync-profile.ts <USERNAME>` | Recalculate user stats |
| `test-refresh.ts` | `npx tsx scripts/test-refresh.ts` | Test price refresh manually |
| `backup-data.ts` | `npx tsx scripts/backup-data.ts` | Export all Redis data |

## 📦 Deployment

Optimized for [Vercel](https://vercel.com):

1. Push code to GitHub
2. Import project into Vercel
3. Add environment variables in Vercel Dashboard
4. Deploy!

### Cron Setup
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/refresh",
    "schedule": "*/15 * * * *"
  }]
}
```

## 🏗️ Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── analyze/        # Main analysis endpoint
│   │   ├── recent/         # Recent analyses CRUD
│   │   └── cron/refresh/   # Price refresh endpoint
│   ├── user/[username]/    # Profile pages
│   └── leaderboard/        # Top/Bottom gurus
├── lib/
│   ├── analyzer.ts         # Analysis orchestrator
│   ├── ai-extractor.ts     # Gemini prompt + extraction
│   ├── market-data.ts      # Price fetching (Yahoo/CG/DexS)
│   ├── price-refresher.ts  # Batch price updates
│   └── analysis-store.ts   # Redis operations
├── components/             # React components
└── scripts/                # Admin utilities
```

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

Built with ❤️ by [@hamzacodesfast](https://x.com/hamzacodesfast)
