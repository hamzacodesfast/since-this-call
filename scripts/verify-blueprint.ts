import { analyzeTweetContent } from '../src/lib/analyzer';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verify() {
    console.log("🚀 Starting Blueprint Verification Tests...\n");

    const tests = [
        {
            name: "Dominance Parsing (Bearish USDT.D -> Bullish BTC)",
            tweet: {
                id_str: "1",
                text: "USDT.D is cooked. Send it.",
                user: { name: "Trader", screen_name: "trader" },
                created_at: new Date().toISOString()
            },
            expected: { symbol: "BTC", sentiment: "BULLISH" }
        },
        {
            name: "Numerical Directionality (Bearish Lower Target)",
            tweet: {
                id_str: "3",
                text: "BTC at 100k is too high. Targeting 80k gap fill.",
                user: { name: "Bear", screen_name: "bear" },
                created_at: new Date().toISOString()
            },
            marketContext: { BTC: 100000 },
            expected: { action: "SELL" }
        },
        {
            name: "Slang Layer (Bullish 'We are so back')",
            tweet: {
                id_str: "4",
                text: "We are so back on $SOL.",
                user: { name: "Bull", screen_name: "bull" },
                created_at: new Date().toISOString()
            },
            expected: { action: "BUY" }
        },
        {
            name: "Regret Parsing (Action > Emotion)",
            tweet: {
                id_str: "5",
                text: "I might regret selling $AAPL here, but I'm out.",
                user: { name: "Seller", screen_name: "seller" },
                created_at: new Date().toISOString()
            },
            expected: { action: "SELL" }
        }
    ];

    for (const t of tests) {
        console.log(`--- Test: ${t.name} ---`);
        console.log(`Text: "${t.tweet.text}"`);
        try {
            // Mock market context for numerical directionality test
            // Note: analyzeTweetContent fetches marketContext via getMajorIndicesPrices
            // So we might need to be careful if we want to force specific prices.
            // But the AI prompt also takes context.

            const result = await analyzeTweetContent(t.tweet);
            console.log(`Result: ${result.analysis.action} on ${result.analysis.symbol}`);
            console.log(`Reasoning: ${result.analysis.reasoning}`);

            let passed = true;
            if (t.expected.symbol && result.analysis.symbol !== t.expected.symbol) passed = false;
            if (t.expected.sentiment && result.analysis.sentiment !== t.expected.sentiment) passed = false;
            if (t.expected.action && result.analysis.action !== t.expected.action) passed = false;

            if (passed) {
                console.log("✅ PASSED");
            } else {
                console.log("❌ FAILED");
                console.log("Expected:", t.expected);
            }
        } catch (e: any) {
            console.error("❌ ERROR:", e.message);
        }
        console.log("\n");
    }
}

verify().catch(console.error);
