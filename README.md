# Since This Call 📉📈

**Since This Call** is a "Social Accountability Engine" that tracks the performance of crypto and stock predictions ("calls") made on X (formerly Twitter).

Paste a tweet URL, and the app will tell you exactly how that asset has performed since the moment the tweet was posted.

![Screenshot Placeholder](public/Screenshot from 2026-01-09 00-23-41.png)

## ✨ Features

- **AI-Powered Extraction**: Uses **Google Gemini** (Flash 2.0) to intelligently parse tweets, identifying the asset symbol (e.g., $BTC, $WOJAK, $NVDA), sentiment (Bullish/Bearish), and the prediction date.
- **Robust Fallback**: Includes a smart Regex safety net to handle AI rate limits ensuring high availability.
- **Multi-Asset Support**:
  - **Crypto**: Real-time prices via **CoinGecko** & **DexScreener** (Meme coins supported!).
  - **Crypto History**: Deep historical data via **Binance** API.
  - **Stocks**: Free, uncapped historical & current data via **Yahoo Finance**.
- **Social Sharing**: One-click visual sharing generates a screenshot of the analysis + original tweet to share back on X.
- **Premium UI**: Built with a sleek, dark-mode first design using Tailwind CSS and Next.js 14.

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **AI**: [Vercel AI SDK](https://sdk.vercel.ai/) + [Google Gemini](https://ai.google.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + `lucide-react` icons
- **Data Sources**:
  - [Yahoo Finance](https://github.com/gadicc/yahoo-finance2) (Stocks)
  - [CoinGecko](https://www.coingecko.com/en/api) (Crypto)
  - [Binance](https://www.binance.com/en/binance-api) (Crypto History)
  - [DexScreener](https://dexscreener.com) (Meme Coins)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed.
- A **Google Gemini** API Key (Free).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/since-this-call.git
    cd since-this-call
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment:**
    Copy the example environment file:
    ```bash
    cp .env.example .env.local
    ```

    Open `.env.local` and add your Gemini key:
    ```env
    # Required for AI Extraction
    GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key_here
    ```

    *   [Get a Gemini API Key](https://aistudio.google.com/app/apikey)

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

5.  **Open the App:**
    Visit `http://localhost:3000` in your browser.

## 🧪 Usage

1.  Find a tweet making a prediction (e.g., "Buying #Bitcoin here!").
2.  Copy the tweet URL.
3.  Paste it into the search bar in **Since This Call**.
4.  Hit **Analyze** to see the ROI/PnL since that date.
5.  Click **Share Result on X** to generate a visual receipt of the call!

## 📦 Deployment

This project is optimized for deployment on [Vercel](https://vercel.com).

1.  Push your code to GitHub/GitLab.
2.  Import the project into Vercel.
3.  Add your `GOOGLE_GENERATIVE_AI_API_KEY` in the Vercel Dashboard Settings -> Environment Variables.
4.  Deploy!

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
