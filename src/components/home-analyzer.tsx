'use client';

import { useState } from 'react';
import { ArrowRight, Search, Loader2, Sparkles, TrendingUp } from 'lucide-react';
import { AnalysisView } from '@/components/analysis-view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

export function HomeAnalyzer() {
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
        <div className="w-full max-w-xl relative mb-16 z-10 mx-auto px-2">
            {!assetType ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in zoom-in-95 duration-300">
                    <Button
                        onClick={() => setAssetType('CRYPTO')}
                        className="h-28 sm:h-32 flex flex-col gap-2 sm:gap-3 rounded-2xl bg-card/80 backdrop-blur-md border border-primary/10 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    >
                        <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 group-hover:scale-110 transition-transform" />
                        <div className="text-lg sm:text-xl font-bold text-foreground">Analyze Crypto</div>
                    </Button>
                    <Button
                        onClick={() => setAssetType('STOCK')}
                        className="h-28 sm:h-32 flex flex-col gap-2 sm:gap-3 rounded-2xl bg-card/80 backdrop-blur-md border border-primary/10 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    >
                        <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500 group-hover:scale-110 transition-transform" />
                        <div className="text-lg sm:text-xl font-bold text-foreground">Analyze Stock</div>
                    </Button>
                </div>
            ) : (
                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300 w-full max-w-lg mx-auto">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                    <form onSubmit={handleAnalyze} className="relative flex flex-col gap-3 p-3 sm:p-2 bg-card/90 backdrop-blur-xl border rounded-2xl shadow-xl ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10">
                                    <Search className="w-5 h-5" />
                                </div>
                                <Input
                                    type="url"
                                    placeholder={`Paste URL for ${assetType === 'CRYPTO' ? 'Crypto' : 'Stock'} Call`}
                                    className="w-full h-14 pl-10 bg-background/50 border-border/50 focus-visible:ring-0 text-base rounded-xl"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <Button
                                type="submit"
                                size="lg"
                                disabled={isLoading || !url}
                                className="h-14 sm:h-14 px-8 rounded-xl font-bold text-md shadow-lg w-full sm:w-auto shrink-0"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Check Receipt'}
                            </Button>
                        </div>
                    </form>
                    <div className="flex justify-center sm:justify-start items-center px-1 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setAssetType(assetType === 'CRYPTO' ? 'STOCK' : 'CRYPTO');
                                setData(null);
                                setError(null);
                            }}
                            className="group flex items-center justify-center gap-2 px-5 py-3 sm:py-2 rounded-full bg-secondary/80 hover:bg-secondary border border-border/50 text-sm font-medium text-foreground transition-all active:scale-95 w-full sm:w-auto shadow-sm"
                        >
                            <ArrowRight className="w-4 h-4 text-primary group-hover:-translate-x-1 transition-transform rotate-180" />
                            <span>Switch to {assetType === 'CRYPTO' ? 'Stocks' : 'Crypto'}</span>
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="mt-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-3 animate-in hover:scale-105 transition-transform">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {error}
                </div>
            )}

            {data && <div className="mt-12"><AnalysisView data={data} /></div>}
        </div>
    );
}
