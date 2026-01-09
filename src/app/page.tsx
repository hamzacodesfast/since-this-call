'use client';

import { useState } from 'react';
import { ArrowRight, Search, Loader2 } from 'lucide-react';
import { AnalysisView } from '@/components/analysis-view';

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
        <main className="min-h-screen bg-background flex flex-col items-center py-24 px-4 relative overflow-hidden">

            {/* Background Gradients */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

            {/* Header */}
            <div className="text-center mb-16 space-y-4 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold tracking-wide uppercase">
                    Social Prediction Tracker
                </div>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/50">
                    Since This Call
                </h1>
                <p className="text-xl text-muted-foreground">
                    Paste a crypto or stock prediction from X/Twitter to see how it aged.
                </p>
            </div>

            {/* Input Form */}
            <form onSubmit={handleAnalyze} className="w-full max-w-xl relative flex items-center mb-12 group">
                <div className="absolute left-4 text-muted-foreground group-focus-within:text-foreground transition-colors">
                    <Search className="w-5 h-5" />
                </div>
                <input
                    type="url"
                    placeholder="https://x.com/username/status/..."
                    className="w-full h-14 pl-12 pr-32 rounded-2xl bg-secondary/50 border border-transparent focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/10 transition-all outline-none text-lg"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                />
                <button
                    type="submit"
                    disabled={isLoading || !url}
                    className="absolute right-2 h-10 px-6 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
                </button>
            </form>

            {/* Error Message */}
            {error && (
                <div className="mb-12 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {error}
                </div>
            )}

            {/* Results */}
            {data && <AnalysisView data={data} />}

        </main>
    );
}
