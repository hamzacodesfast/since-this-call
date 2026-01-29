'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, Loader2, Sparkles, TrendingUp, Clock, Trophy, BarChart3, BadgeAlert } from 'lucide-react';
import { AnalysisView } from '@/components/analysis-view';
import { MetricsBar } from '@/components/metrics-bar';
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
    const [assetType, setAssetType] = useState<'CRYPTO' | 'STOCK' | null>(null);
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
            let apiUrl = `/api/analyze?url=${encodeURIComponent(url)}&type=${assetType}`;
            if (pumpfunUrl && assetType === 'CRYPTO') {
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
                    // Ensure timestamp is valid, otherwise undefined (which triggers fallback, but better than NaN)
                    timestamp: !isNaN(new Date(json.tweet.date).getTime()) ? new Date(json.tweet.date).getTime() : undefined,
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
                    The AI Powered Social Prediction Tracker
                </Badge>

                <h1 className="text-5xl md:text-8xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/40 pb-2">
                    Since This Call
                </h1>

                <p className="text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
                    The ultimate lie detector for Crypto & Stock gurus. Choose your asset to see the <span className="text-foreground font-semibold">real receipts</span>.
                </p>
            </div>

            {/* Platform Metrics */}
            <MetricsBar />

            {/* Input Form / Type Selection */}
            <div className="w-full max-w-xl relative mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 z-10">
                {!assetType ? (
                    /* Initial Selection View */
                    <div className="grid grid-cols-2 gap-4 animate-in zoom-in-95 duration-300">
                        <Button
                            onClick={() => setAssetType('CRYPTO')}
                            className="h-32 flex flex-col gap-3 rounded-2xl bg-card/80 backdrop-blur-md border border-primary/10 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                        >
                            <Sparkles className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform" />
                            <div className="text-xl font-bold text-foreground">Analyze Crypto</div>
                        </Button>
                        <Button
                            onClick={() => setAssetType('STOCK')}
                            className="h-32 flex flex-col gap-3 rounded-2xl bg-card/80 backdrop-blur-md border border-primary/10 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                        >
                            <TrendingUp className="w-8 h-8 text-purple-500 group-hover:scale-110 transition-transform" />
                            <div className="text-xl font-bold text-foreground">Analyze Stock</div>
                        </Button>
                    </div>
                ) : (
                    /* Search Mode View */
                    <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>

                        <form onSubmit={handleAnalyze} className="relative flex flex-col gap-2 p-2 bg-card/80 backdrop-blur-md border rounded-2xl shadow-xl ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                        <Search className="w-5 h-5" />
                                    </div>
                                    <Input
                                        type="url"
                                        placeholder={`Paste Tweet URL for ${assetType === 'CRYPTO' ? 'Crypto' : 'Stock'} Call`}
                                        className="w-full h-12 pl-10 bg-transparent border-none focus-visible:ring-0 text-base"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        autoFocus
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

                            {/* Optional Pump.fun URL - ONLY for Crypto */}
                            {assetType === 'CRYPTO' && (
                                <div className="relative">
                                    <Input
                                        type="url"
                                        placeholder="Optional: pump.fun or dexscreener.com URL"
                                        className="w-full h-10 pl-4 bg-secondary/30 border-none focus-visible:ring-0 text-sm rounded-lg placeholder:text-muted-foreground/50"
                                        value={pumpfunUrl}
                                        onChange={(e) => setPumpfunUrl(e.target.value)}
                                    />
                                </div>
                            )}
                        </form>

                        {/* Quick Mode Toggle */}
                        <div className="flex justify-between items-center px-2">
                            <button
                                onClick={() => {
                                    setAssetType(assetType === 'CRYPTO' ? 'STOCK' : 'CRYPTO');
                                    setData(null);
                                    setError(null);
                                }}
                                className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                            >
                                <ArrowRight className="w-3 h-3 rotate-180" />
                                Switch to {assetType === 'CRYPTO' ? 'Stocks' : 'Crypto'}
                            </button>

                            {/* Quick Prompts / Examples */}
                            {!data && !isLoading && (
                                <div className="flex gap-2 opacity-60">
                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider pt-1">Try:</span>
                                    <button
                                        className="text-[10px] hover:text-foreground transition-colors"
                                        onClick={() => setUrl(assetType === 'CRYPTO' ? 'https://x.com/nntaleb/status/1408395330471829504' : 'https://x.com/jimcramer/status/2002112942054215875')}
                                    >
                                        {assetType === 'CRYPTO' ? '$BTC Example' : 'Jim Cramer Example'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
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

            {/* Features & Limitations - Only show when no results */}
            {!data && !isLoading && (
                <div className="w-full max-w-2xl text-left space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Features */}
                        <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border shadow-sm space-y-4">
                            <div className="flex items-center gap-2 text-primary">
                                <Sparkles className="w-5 h-5" />
                                <h3 className="font-semibold text-lg">Coverage Intelligence</h3>
                            </div>
                            <ul className="space-y-3 text-sm text-muted-foreground">
                                <li className="flex items-start gap-3">
                                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                    <div>
                                        <strong className="text-foreground block mb-0.5">Equities & ETFs</strong>
                                        <p className="text-xs opacity-80 leading-relaxed">Universal coverage of US Stocks (NYSE/NASDAQ) via Yahoo Finance.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                    <div>
                                        <strong className="text-foreground block mb-0.5">Crypto & DeFi</strong>
                                        <p className="text-xs opacity-80 leading-relaxed">Instant mapping of 20,000+ assets across CEX and DEX protocols.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                                    <div>
                                        <strong className="text-foreground block mb-0.5">Meme Economy</strong>
                                        <p className="text-xs opacity-80 leading-relaxed">Direct integration with Pump.fun & DexScreener for micro-caps.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                    <div>
                                        <strong className="text-foreground block mb-0.5">Live PnL Engine</strong>
                                        <p className="text-xs opacity-80 leading-relaxed">Real-time performance marking against the exact minute of the call.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        {/* Limitations */}
                        <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border shadow-sm space-y-4">
                            <div className="flex items-center gap-2 text-amber-500">
                                <BadgeAlert className="w-5 h-5" />
                                <h3 className="font-semibold text-lg">System Constraints</h3>
                            </div>
                            <ul className="space-y-3 text-sm text-muted-foreground">
                                <li className="flex items-start gap-3">
                                    <span className="text-amber-500 mt-0.5 text-xs">●</span>
                                    <div>
                                        <strong className="text-foreground block mb-0.5">Liquidity Delay</strong>
                                        <p className="text-xs opacity-80 leading-relaxed">Tokens less than 5 minutes old may not have stable pricing data.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-amber-500 mt-0.5 text-xs">●</span>
                                    <div>
                                        <strong className="text-foreground block mb-0.5">Historical Granularity</strong>
                                        <p className="text-xs opacity-80 leading-relaxed">Tweets older than 30 days use daily-close data instead of minute-precision.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-amber-500 mt-0.5 text-xs">●</span>
                                    <div>
                                        <strong className="text-foreground block mb-0.5">Linguistic Nuance</strong>
                                        <p className="text-xs opacity-80 leading-relaxed">The AI is tuned for calls; heavy sarcasm or "doom-posting" can be misread.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

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
                    <Link href="/stats">
                        <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Stats
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

