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

const CACHE_DURATION = 5 * 60 * 1000;

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
    } catch { return null; }
}

function setCachedData(url: string, data: any) {
    try {
        localStorage.setItem(`stc_cache_${url}`, JSON.stringify({ data, timestamp: Date.now() }));
    } catch { }
}

export default function Home() {
    const [url, setUrl] = useState('');
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

        const cached = getCachedData(url);
        if (cached) {
            setData(cached);
            setIsLoading(false);
            return;
        }

        try {
            let apiUrl = `/api/analyze?url=${encodeURIComponent(url)}&type=${assetType}`;
            const res = await fetch(apiUrl);
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || 'Failed to analyze tweet');
            }

            setCachedData(url, json);
            setData(json);

            // Save to recent
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
                    timestamp: !isNaN(new Date(json.tweet.date).getTime()) ? new Date(json.tweet.date).getTime() : undefined,
                }),
            }).catch(() => { });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-background flex flex-col items-center py-24 px-4 relative overflow-hidden text-center selection:bg-primary/20">
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse delay-700" />
            </div>

            <div className="mb-12 space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Badge variant="secondary" className="px-4 py-1.5 text-xs font-medium uppercase tracking-widest bg-secondary/50 backdrop-blur-md border border-primary/10">
                    <NextImage src="/logo.png" alt="Since This Call" width={16} height={16} className="mr-2" />
                    The AI Powered Social Prediction Tracker
                </Badge>
                <h1 className="text-5xl md:text-8xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/40 pb-2">
                    Since This Call
                </h1>
                <p className="text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
                    Receipts for Crypto & Stock Gurus. <br />
                    <span className="text-foreground/60 text-sm italic">Tracking major assets found on Yahoo Finance, CoinMarketCap & CoinGecko.</span>
                </p>
            </div>

            <MetricsBar />

            <div className="w-full max-w-xl relative mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 z-10">
                {!assetType ? (
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
                        </form>
                        <div className="flex justify-center sm:justify-between items-center px-1 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setAssetType(assetType === 'CRYPTO' ? 'STOCK' : 'CRYPTO');
                                    setData(null);
                                    setError(null);
                                }}
                                className="group flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 hover:bg-secondary text-sm font-medium text-foreground transition-all active:scale-95"
                            >
                                <ArrowRight className="w-4 h-4 text-primary group-hover:-translate-x-1 transition-transform rotate-180" />
                                <span>Switch to {assetType === 'CRYPTO' ? 'Stocks' : 'Crypto'}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="mb-12 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-3 animate-in hover:scale-105 transition-transform">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {error}
                </div>
            )}

            {data && <AnalysisView data={data} />}

            {!data && !isLoading && (
                <div className="w-full max-w-2xl text-left space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    <div className="grid md:grid-cols-2 gap-6">
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
                                        <p className="text-xs opacity-80 leading-relaxed">Coverage of US Stocks (NYSE/NASDAQ) via Yahoo Finance.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                    <div>
                                        <strong className="text-foreground block mb-0.5">Top-Tier Crypto</strong>
                                        <p className="text-xs opacity-80 leading-relaxed">Major assets listed on CMC and CoinGecko. No DEX-only tokens.</p>
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
                        <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border shadow-sm space-y-4">
                            <div className="flex items-center gap-2 text-amber-500">
                                <BadgeAlert className="w-5 h-5" />
                                <h3 className="font-semibold text-lg">System Constraints</h3>
                            </div>
                            <ul className="space-y-3 text-sm text-muted-foreground">
                                <li className="flex items-start gap-3">
                                    <span className="text-amber-500 mt-0.5 text-xs">●</span>
                                    <div>
                                        <strong className="text-foreground block mb-0.5">No Meme Coins</strong>
                                        <p className="text-xs opacity-80 leading-relaxed">We do not track unlisted tokens or pump.fun moonshots.</p>
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
                                        <strong className="text-foreground block mb-0.5">Major Assets Only</strong>
                                        <p className="text-xs opacity-80 leading-relaxed">The system rejects assets not found on authoritative data providers.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-auto py-12 text-center space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link href="/recent"><Button variant="ghost" className="text-muted-foreground hover:text-foreground"><Clock className="w-4 h-4 mr-2" />Recent</Button></Link>
                    <Link href="/leaderboard"><Button variant="ghost" className="text-muted-foreground hover:text-primary"><Trophy className="w-4 h-4 mr-2" />Leaderboard</Button></Link>
                    <Link href="/stats"><Button variant="ghost" className="text-muted-foreground hover:text-foreground"><BarChart3 className="w-4 h-4 mr-2" />Stats</Button></Link>
                    <Link href="/profiles"><Button variant="ghost" className="text-muted-foreground hover:text-foreground">Profiles</Button></Link>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground opacity-30">
                    <TrendingUp className="w-3 h-3" />
                    <span>Real Data • No Hype</span>
                </div>
            </div>
        </main>
    );
}
