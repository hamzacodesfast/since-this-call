
/**
 * Analyze a new tweet by ID and save it to Redis.
 * Usage: npx tsx scripts/analyze-by-id.ts <TWEET_ID> [CA_OVERRIDE] [--symbol=SYMBOL] [--action=BUY/SELL]
 */

import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function main() {
    const { analyzeTweet } = await import('../src/lib/analyzer');
    const { updateUserProfile, addAnalysis } = await import('../src/lib/analysis-store');

    const tweetId = process.argv[2];
    const symbolOverride = process.argv.find(a => a.startsWith('--symbol='))?.split('=')[1];
    const actionOverride = process.argv.find(a => a.startsWith('--action='))?.split('=')[1] as 'BUY' | 'SELL' | undefined;
    const caOverride = process.argv[3]?.startsWith('--') ? undefined : process.argv[3];

    if (!tweetId) {
        console.error('❌ Usage: npx tsx scripts/analyze-by-id.ts <TWEET_ID> [CA_OVERRIDE] [--symbol=SYMBOL] [--action=BUY/SELL]');
        process.exit(1);
    }

    console.log(`🚀 Analyzing new tweet ${tweetId}...`);

    try {
        const sentimentOverride = actionOverride === 'BUY' ? 'BULLISH' :
            actionOverride === 'SELL' ? 'BEARISH' : undefined;

        const result = await analyzeTweet(tweetId, caOverride as any, symbolOverride, sentimentOverride);

        console.log(`\n🤖 AI Extraction:`);
        console.log(`   Action: ${result.analysis.action}`);
        console.log(`   Ticker: ${result.analysis.ticker}`);
        console.log(`   Reasoning: ${result.analysis.reasoning}`);

        // Map AnalysisResult to StoredAnalysis
        const storedAnalysis = {
            id: result.tweet.id,
            username: result.tweet.username,
            author: result.tweet.author,
            avatar: result.tweet.avatar,
            symbol: result.analysis.symbol,
            sentiment: result.analysis.sentiment,
            performance: result.market.performance,
            isWin: result.market.performance > 0,
            timestamp: new Date(result.tweet.date).getTime(),
            entryPrice: result.market.callPrice,
            currentPrice: result.market.currentPrice,
            type: result.analysis.type,
            ticker: result.analysis.ticker,
            action: result.analysis.action,
            confidence_score: result.analysis.confidence_score,
            timeframe: result.analysis.timeframe,
            is_sarcasm: result.analysis.is_sarcasm,
            reasoning: result.analysis.reasoning,
            warning_flags: result.analysis.warning_flags,
            tweetUrl: `https://x.com/${result.tweet.username}/status/${result.tweet.id}`,
            text: result.tweet.text,
        };

        console.log(`\n💾 Storing analysis...`);
        await updateUserProfile(storedAnalysis as any);
        await addAnalysis(storedAnalysis as any);
        console.log(`✅ Success! Analysis stored and profile updated.`);
        process.exit(0);
    } catch (e: any) {
        console.error('❌ Analysis failed:', e.message);
        process.exit(1);
    }
}

main();
