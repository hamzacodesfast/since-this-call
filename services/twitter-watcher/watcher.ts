#!/usr/bin/env npx tsx
/**
 * @file watcher.ts
 * @description Twitter Watcher - Browser automation to detect and submit financial calls
 */
import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env files
dotenv.config({ path: path.resolve(__dirname, '../../.env.production') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// CLI Flags
const args = process.argv.slice(2);
const isLoginMode = args.includes('--login');
const isDryRun = args.includes('--dry-run');
const isHeadless = args.includes('--headless'); // Now you must explicitly request headless
const isVisible = !isHeadless || isLoginMode;

// Load detected calls for deduplication and logging
let detectedCalls: any[] = [];
let seenCallIds: Set<string> = new Set();

if (fs.existsSync(config.detectedCallsFile)) {
    try {
        detectedCalls = JSON.parse(fs.readFileSync(config.detectedCallsFile, 'utf8'));
        // Build deduplication set from existing detected calls
        seenCallIds = new Set(detectedCalls.map((c: any) => c.tweetId));
    } catch {
        detectedCalls = [];
    }
}

function logDetectedCall(tweet: { id: string; url: string; text: string }) {
    detectedCalls.push({
        timestamp: new Date().toISOString(),
        tweetId: tweet.id,
        url: tweet.url,
        text: tweet.text.substring(0, 300),
    });
    seenCallIds.add(tweet.id);
    fs.writeFileSync(config.detectedCallsFile, JSON.stringify(detectedCalls, null, 2));
    console.log(`   💾 Saved to detected-calls.json`);
}

// Pre-compile asset regex for performance
// Escape special chars to prevent regex errors (e.g. "s&p" -> "s&p")
const escapedAssets = config.assetNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const assetRegex = new RegExp(`\\b(${escapedAssets.join('|')})\\b`, 'i');

// Require (ticker OR asset name) AND an action signal
function matchesTrigger(text: string): boolean {
    const hasTicker = config.tickerPattern.test(text);
    const hasAssetName = assetRegex.test(text);
    const hasAction = config.actionPatterns.some(pattern => pattern.test(text));

    return (hasTicker || hasAssetName) && hasAction;
}

async function extractTweets(page: Page): Promise<{ id: string; url: string; text: string }[]> {
    return await page.evaluate(() => {
        const tweets: { id: string; url: string; text: string }[] = [];
        const articles = document.querySelectorAll('article[data-testid="tweet"]');

        articles.forEach(article => {
            // Find tweet link (contains /status/)
            const links = article.querySelectorAll('a[href*="/status/"]');
            let tweetUrl = '';
            let tweetId = '';

            for (const link of links) {
                const href = (link as HTMLAnchorElement).href;
                const match = href.match(/\/status\/(\d+)/);
                if (match) {
                    tweetId = match[1];
                    tweetUrl = href;
                    break;
                }
            }

            // Get tweet text
            const textEl = article.querySelector('[data-testid="tweetText"]');
            const text = textEl?.textContent || '';

            if (tweetId && text) {
                tweets.push({ id: tweetId, url: tweetUrl, text });
            }
        });

        return tweets;
    });
}

async function runWatcher() {
    console.log('🚀 Starting Twitter Watcher...');
    console.log(`   Mode: ${isLoginMode ? 'LOGIN' : isDryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   Target: ${config.targetUrl}`);
    console.log(`   Profile: ${config.chromeProfilePath}\n`);

    // Ensure profile directory exists
    if (!fs.existsSync(config.chromeProfilePath)) {
        fs.mkdirSync(config.chromeProfilePath, { recursive: true });
    }

    // Check for lock file (another instance running)
    const lockFile = `${config.chromeProfilePath}/SingletonLock`;
    if (fs.existsSync(lockFile)) {
        console.log('⚠️  Another browser instance is using this profile.');
        console.log('   Close the other browser window first, or wait for it to exit.');
        console.log('   (If you ran `npm run login`, close that browser to save your session.)\n');
        process.exit(1);
    }

    let browser: Browser;
    try {
        browser = await puppeteer.launch({
            headless: isVisible ? false : true,
            userDataDir: config.chromeProfilePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
            ],
            defaultViewport: { width: 1280, height: 900 },
        });
    } catch (err: any) {
        if (err.message.includes('already running')) {
            console.log('⚠️  Browser profile is locked. Close any other browser using this profile.');
            process.exit(1);
        }
        throw err;
    }

    const page: Page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(config.targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    if (isLoginMode) {
        console.log('\n📱 LOGIN MODE: Please log into Twitter in the browser window.');
        console.log('   Once logged in, close the browser to save your session.\n');
        await browser.waitForTarget(() => false, { timeout: 0 }).catch(() => { });
        console.log('✅ Session saved. You can now run `npm run watch`.');
        return;
    }

    // Check if we're logged in
    const isLoggedIn = await page.evaluate(() => {
        return document.querySelector('[data-testid="SideNav_NewTweet_Button"]') !== null ||
            document.querySelector('[aria-label="Post"]') !== null ||
            document.querySelector('[data-testid="primaryColumn"]') !== null;
    });

    if (!isLoggedIn) {
        console.log('❌ Not logged in. Run `npm run login` first.');
        await browser.close();
        process.exit(1);
    }

    console.log('✅ Logged in. Starting watch loop...\n');

    // Main watch loop - Infinite scroll with periodic refresh
    let cycleCount = 0;
    let scrollPosition = 0;
    const REFRESH_EVERY_CYCLES = 12; // Refresh page every 12 cycles (approx 60s) to catch newest tweets

    while (true) {
        cycleCount++;
        console.log(`\n--- Cycle ${cycleCount} (${new Date().toLocaleTimeString()}) ---`);

        try {
            // Continuous infinite scroll - keep scrolling down
            scrollPosition += 1500;
            await page.evaluate((pos) => window.scrollTo(0, pos), scrollPosition);
            await new Promise(r => setTimeout(r, 2000));

            // Extract visible tweets
            const tweets = await extractTweets(page);
            let detected = 0;

            for (const tweet of tweets.slice(0, config.maxTweetsPerCycle)) {
                // Only process tweets that match trigger patterns and haven't been detected before
                if (!matchesTrigger(tweet.text)) continue;
                if (seenCallIds.has(tweet.id)) continue;

                detected++;
                console.log(`\n🎯 Financial call detected:`);
                console.log(`   ${tweet.text.substring(0, 120)}...`);
                console.log(`   ${tweet.url}`);
                logDetectedCall(tweet);

                try {
                    const { analyzeTweet } = await import('../../src/lib/analyzer');
                    const { updateUserProfile, addAnalysis } = await import('../../src/lib/analysis-store');
                    
                    console.log(`🤖 Sending to AI Analyzer immediately...`);
                    const result = await analyzeTweet(tweet.id);
                    
                    if (!result) {
                        console.log(`ℹ️ AI determined it was noise.`);
                    } else if (!result.analysis.action) {
                        console.log(`❌ Failed: Invalid analysis result (No Action)`);
                    } else {
                        console.log(`✅ Extracted: ${result.analysis.action} ${result.analysis.symbol} @ $${result.market.callPrice}`);
                        
                        const storedItem = {
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
                            ticker: result.analysis.symbol,
                            action: result.analysis.action,
                            confidence_score: result.analysis.confidence_score,
                            timeframe: result.analysis.timeframe,
                            is_sarcasm: result.analysis.is_sarcasm,
                            reasoning: result.analysis.reasoning,
                            warning_flags: result.analysis.warning_flags,
                            tweetUrl: `https://x.com/${result.tweet.username}/status/${result.tweet.id}`,
                            text: result.tweet.text
                        };

                        await updateUserProfile(storedItem);
                        await addAnalysis(storedItem);
                        console.log(`✅ Saved to @${storedItem.username} in production database!`);
                    }
                } catch (e: any) {
                    console.error(`❌ Analysis failed:`, e.message);
                }
            }

            console.log(`   Scanned ${tweets.length} tweets, ${detected} calls detected`);

            // Refresh page periodically to catch newest tweets at top
            if (cycleCount % REFRESH_EVERY_CYCLES === 0) {
                console.log('🔄 Refreshing page to catch newest tweets...');
                await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
                scrollPosition = 0;
                await new Promise(r => setTimeout(r, 3000));
            }

        } catch (err: any) {
            console.error(`⚠️ Cycle error: ${err.message}`);
        }

        // Wait before next cycle
        await new Promise(r => setTimeout(r, config.pollInterval));
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down watcher...');
    process.exit(0);
});

runWatcher().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
