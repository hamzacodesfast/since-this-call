'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Clock, RefreshCw, MinusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import NextImage from 'next/image';
import { AnalysisCard } from '@/components/analysis-card';

interface StoredAnalysis {
    id: string;
    username: string;
    author: string;
    avatar?: string;
    symbol: string;
    sentiment: 'BULLISH' | 'BEARISH';
    performance: number;
    isWin: boolean;
    timestamp: number;
    entryPrice?: number;
    currentPrice?: number;
}

export default function RecentPage() {
    const [analyses, setAnalyses] = useState<StoredAnalysis[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRecent = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/recent');
            const data = await res.json();
            setAnalyses(data.analyses || []);
        } catch (e) {
            console.error('Failed to fetch recent analyses:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecent();
    }, []);

    const formatTimeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    return (
        <main className="min-h-screen bg-background relative overflow-hidden">
            {/* Background gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 container mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                        </Link>
                        <div className="flex items-center gap-3">
                            <NextImage
                                src="/logo.png"
                                alt="SinceThisCall"
                                width={32}
                                height={32}
                                className="rounded"
                            />
                            <h1 className="text-2xl font-bold">Recent Analyses</h1>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchRecent} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : analyses.length === 0 ? (
                    <div className="text-center py-20">
                        <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <h2 className="text-xl font-semibold mb-2">No analyses yet</h2>
                        <p className="text-muted-foreground mb-4">Be the first to analyze a tweet!</p>
                        <Link href="/">
                            <Button>Analyze a Tweet</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {analyses.map((analysis) => (
                            <AnalysisCard key={`${analysis.id}-${analysis.timestamp}`} analysis={analysis} />
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
