'use client';

import { useState } from 'react';
import { ArrowRight, Search, Loader2 } from 'lucide-react';
import { AnalysisView } from '@/components/analysis-view';

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

        try {
            const res = await fetch(`/api/analyze?url=${encodeURIComponent(url)}`);
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || 'Failed to analyze tweet');
            }

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
                    Social Accountability Engine
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

            {/* Footer Branding */}
            <div className="mt-auto py-8 text-center space-y-2 opacity-50 hover:opacity-100 transition-opacity">
                <p className="text-sm font-medium">Powered by</p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        Google Gemini 2.0 Flash
                    </span>
                    <span>•</span>
                    <span>v0.1.0</span>
                </div>
            </div>

        </main>
    );
}
