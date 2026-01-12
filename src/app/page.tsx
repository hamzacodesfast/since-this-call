'use client';

import { useState } from 'react';
import { ArrowRight, Search, Loader2, Sparkles, TrendingUp } from 'lucide-react';
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
            const res = await fetch(`/api/analyze?url=${encodeURIComponent(url)}`);
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || 'Failed to analyze tweet');
            }

            // Cache successful response
            setCachedData(url, json);
            setData(json);
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

                <form onSubmit={handleAnalyze} className="relative flex gap-2 p-2 bg-card/80 backdrop-blur-md border rounded-2xl shadow-xl ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
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
                </form>

                {/* Quick Prompts / Examples */}
                {!data && !isLoading && (
                    <div className="mt-6 flex flex-wrap justify-center gap-2 opacity-60">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mr-2 pt-1">Try:</span>
                        <Button variant="outline" size="sm" className="h-7 text-xs rounded-full bg-background/50 hover:bg-background" onClick={() => setUrl('https://x.com/nntaleb/status/1408395330471829504')}>
                            $BTC Prediction
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs rounded-full bg-background/50 hover:bg-background" onClick={() => setUrl('https://x.com/jimcramer/status/2002112942054215875')}>
                            Jim Cramer (Inverse)
                        </Button>
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

            {/* Footer Branding */}
            <div className="mt-auto py-12 text-center space-y-4 opacity-30 hover:opacity-100 transition-opacity duration-500">
                <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    <TrendingUp className="w-3 h-3" />
                    <span>Real Data • No Hype</span>
                </div>
            </div>

        </main>
    );
}
