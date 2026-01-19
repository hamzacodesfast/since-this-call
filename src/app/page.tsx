'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, Loader2, Sparkles, TrendingUp, Clock, Trophy } from 'lucide-react';
import { AnalysisView } from '@/components/analysis-view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import NextImage from 'next/image';

// Cache duration: 5 minutes (in milliseconds)
const CACHE_DURATION = 5 * 60 * 1000;

// Helper to get cached data
function getCachedData(url: string) {
    try {
        const cached = localStorage.getItem(`stc_cache_${url}`);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp > CACHE_DURATION) {
            localStorage.removeItem(`stc_cache_${url}`);
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

// Helper to set cached data
function setCachedData(url: string, data: any) {
    try {
        localStorage.setItem(`stc_cache_${url}`, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch {
        // Ignore storage errors (quota exceeded, etc.)
    }
}

export default function Home() {
    const [url, setUrl] = useState('');
    const [pumpfunUrl, setPumpfunUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<any | null>(null);

    async function handleAnalyze(e: React.FormEvent) {
        e.preventDefault();
        if (!url) return;

        setIsLoading(true);
        setError(null);
        setData(null);

        // Check cache first
        const cached = getCachedData(url);
        if (cached) {
            setData(cached);
            setIsLoading(false);
            return;
        }

        try {
            let apiUrl = `/api/analyze?url=${encodeURIComponent(url)}`;
            if (pumpfunUrl) {
                apiUrl += `&pumpfun=${encodeURIComponent(pumpfunUrl)}`;
            }
            const res = await fetch(apiUrl);
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || 'Failed to analyze tweet');
            }

            // Cache successful response
            setCachedData(url, json);
            setData(json);

            // Save to recent analyses (fire and forget)
            const isWin = json.market.performance > 0;

            fetch('/api/recent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: json.tweet.id,
                    username: json.tweet.username,
                    author: json.tweet.author,
                    avatar: json.tweet.avatar,
                    symbol: json.analysis.symbol,
                    sentiment: json.analysis.sentiment,
                    performance: json.market.performance,
                    isWin,
                    entryPrice: json.market.callPrice,
                    currentPrice: json.market.currentPrice,
                    type: json.analysis.type,
                    contractAddress: json.analysis.contractAddress,
                }),
            }).catch(() => { }); // Ignore errors
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-background flex flex-col items-center py-24 px-4 relative overflow-hidden text-center selection:bg-primary/20">

            {/* Dynamic Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse delay-700" />
            </div>

            {/* Header */}
            <div className="mb-12 space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Badge variant="secondary" className="px-4 py-1.5 text-xs font-medium uppercase tracking-widest bg-secondary/50 backdrop-blur-md border border-primary/10">
                    <NextImage src="/logo.png" alt="Since This Call" width={16} height={16} className="mr-2" />
                    Social Prediction Tracker
                </Badge>

                <h1 className="text-5xl md:text-8xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/40 pb-2">
                    Since This Call
                </h1>

                <p className="text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
                    The ultimate lie detector for Crypto & Stock gurus. Paste a prediction tweet to see the <span className="text-foreground font-semibold">real receipts</span>.
                </p>
            </div>

            {/* Input Form */}
            <div className="w-full max-w-xl relative mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 z-10">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>

                <form onSubmit={handleAnalyze} className="relative flex flex-col gap-2 p-2 bg-card/80 backdrop-blur-md border rounded-2xl shadow-xl ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                <Search className="w-5 h-5" />
                            </div>
                            <Input
                                type="url"
                                placeholder="Paste Tweet URL (e.g. https://x.com/...)"
                                className="w-full h-12 pl-10 bg-transparent border-none focus-visible:ring-0 text-base"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                        </div>
                        <Button
                            type="submit"
                            size="lg"
                            disabled={isLoading || !url}
                            className="h-12 px-8 rounded-xl font-bold text-md shadow-lg"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Check Receipt'}
                        </Button>
                    </div>

                    {/* Optional Pump.fun URL for meme coins */}
                    <div className="relative">
                        <Input
                            type="url"
                            placeholder="Optional: pump.fun or dexscreener.com URL"
                            className="w-full h-10 pl-4 bg-secondary/30 border-none focus-visible:ring-0 text-sm rounded-lg placeholder:text-muted-foreground/50"
                            value={pumpfunUrl}
                            onChange={(e) => setPumpfunUrl(e.target.value)}
                        />
                    </div>
                </form>

                {/* Quick Prompts / Examples */}
                {!data && !isLoading && (
                    <div className="mt-6 flex flex-wrap justify-center gap-2 opacity-60">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mr-2 pt-1">Try:</span>
                        <Button variant="outline" size="sm" className="h-7 text-xs rounded-full bg-background/50 hover:bg-background" onClick={() => setUrl('https://x.com/nntaleb/status/1408395330471829504')}>
                            $BTC Prediction
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs rounded-full bg-background/50 hover:bg-background" onClick={() => setUrl('https://x.com/jimcramer/status/2002112942054215875')}>
                            Jim Cramer
                        </Button>
                    </div>
                )}
            </div>

            {/* Features & Limitations */}
            <div className="w-full max-w-2xl text-left space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Features */}
                    <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                            <Sparkles className="w-5 h-5" />
                            <h3 className="font-semibold text-lg">Supported Assets</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <div>
                                    <strong className="text-foreground">Stocks</strong>
                                    <p className="text-xs opacity-80">All tickers via Yahoo Finance (AAPL, TSLA, etc.)</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <div>
                                    <strong className="text-foreground">Major Crypto</strong>
                                    <p className="text-xs opacity-80">BTC, ETH, SOL, DOGE, XRP, BNB + 50 more via CoinGecko</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <div>
                                    <strong className="text-foreground">Meme Coins & Pump.fun</strong>
                                    <p className="text-xs opacity-80">Auto-discovery via DexScreener & GeckoTerminal</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✓</span>
                                <div>
                                    <strong className="text-foreground">Live Tracking</strong>
                                    <p className="text-xs opacity-80">Prices update automatically, badges flip in real-time</p>
                                </div>
                            </li>
                        </ul>
                    </div>

                    {/* Limitations */}
                    <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-amber-500">
                            <TrendingUp className="w-5 h-5" />
                            <h3 className="font-semibold text-lg">Limitations</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                                <span className="text-amber-500 mt-0.5">⚠</span>
                                <div>
                                    <strong className="text-foreground">Old Tweets (&gt;7 days)</strong>
                                    <p className="text-xs opacity-80">May lack precise historical prices for obscure tokens</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-amber-500 mt-0.5">⚠</span>
                                <div>
                                    <strong className="text-foreground">Brand New Tokens</strong>
                                    <p className="text-xs opacity-80">Need at least a few minutes of trading history</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-amber-500 mt-0.5">⚠</span>
                                <div>
                                    <strong className="text-foreground">Ambiguous Calls</strong>
                                    <p className="text-xs opacity-80">AI may misinterpret vague or sarcastic tweets</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-12 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-3 animate-in hover:scale-105 transition-transform">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {error}
                </div>
            )}

            {/* Results */}
            {data && <AnalysisView data={data} />}

            {/* Footer Branding */}
            <div className="mt-auto py-12 text-center space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link href="/recent">
                        <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                            <Clock className="w-4 h-4 mr-2" />
                            Recent Analyses
                        </Button>
                    </Link>
                    <Link href="/leaderboard">
                        <Button variant="ghost" className="text-muted-foreground hover:text-primary">
                            <Trophy className="w-4 h-4 mr-2" />
                            Leaderboard
                        </Button>
                    </Link>
                    <Link href="/profiles">
                        <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                            All Profiles
                        </Button>
                    </Link>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground opacity-30 hover:opacity-100 transition-opacity duration-500">
                    <TrendingUp className="w-3 h-3" />
                    <span>Real Data • No Hype</span>
                </div>
            </div>

        </main>
    );
}
