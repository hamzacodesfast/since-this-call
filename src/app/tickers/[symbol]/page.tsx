
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus, Activity, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalysisCard } from '@/components/analysis-card';
import { useParams } from 'next/navigation';

interface TickerProfile {
    symbol: string;
    type: 'CRYPTO' | 'STOCK';
    totalAnalyses: number;
    wins: number;
    losses: number;
    neutral: number;
    winRate: number;
    lastAnalyzed: number;
}

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

export default function TickerDetailPage() {
    const params = useParams();
    const symbol = params.symbol as string;

    const [profile, setProfile] = useState<TickerProfile | null>(null);
    const [analyses, setAnalyses] = useState<StoredAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/tickers/${symbol}`);
            if (!res.ok) throw new Error('Ticker not found');

            const data = await res.json();
            setProfile(data.profile);
            setAnalyses(data.analyses || []);
        } catch (e) {
            console.error('Failed to fetch ticker details:', e);
            setError('Failed to load ticker data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (symbol) fetchData();
    }, [symbol]);

    return (
        <main className="min-h-screen bg-background relative overflow-hidden">
            {/* Background gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[20%] w-[30%] h-[30%] bg-green-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-20%] right-[20%] w-[30%] h-[30%] bg-blue-500/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 container mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/tickers">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                        </Link>
                        <h1 className="text-3xl font-bold tracking-tight">{symbol.toUpperCase()}</h1>
                        {profile?.type === 'CRYPTO' && (
                            <span className="bg-blue-500/10 text-blue-400 text-xs px-2 py-1 rounded">CRYPTO</span>
                        )}
                        {profile?.type === 'STOCK' && (
                            <span className="bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded">STOCK</span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {/* External Links */}
                        {/* <a
                            href={`https://dexscreener.com/search?q=${symbol}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button variant="outline" size="sm">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                DexScreener
                            </Button>
                        </a> */}
                        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error || !profile ? (
                    <div className="text-center py-20">
                        <h2 className="text-xl font-semibold text-red-500 mb-2">{error || 'Ticker not found'}</h2>
                        <Link href="/tickers"><Button>Go Back</Button></Link>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className={`text-3xl font-bold ${profile.winRate > 50 ? 'text-green-500' : 'text-red-500'}`}>
                                        {profile.winRate.toFixed(1)}%
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Based on {profile.totalAnalyses} calls
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Calls</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold">{profile.totalAnalyses}</div>
                                    <div className="flex items-center gap-2 mt-1 text-xs">
                                        <span className="text-green-500 flex items-center"><TrendingUp className="w-3 h-3 mr-0.5" />{profile.wins}</span>
                                        <span className="text-red-500 flex items-center"><TrendingDown className="w-3 h-3 mr-0.5" />{profile.losses}</span>
                                        <span className="text-yellow-500 flex items-center"><Minus className="w-3 h-3 mr-0.5" />{profile.neutral}</span>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Analysis Trend</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {/* Simple trend logic using last 5 analyses if available */}
                                    <div className="flex items-center h-full pt-1">
                                        <div className="flex gap-1 h-8 items-end">
                                            {/* Visual bar chart of last 5 results (mockup logic) */}
                                            {analyses.slice(0, 10).reverse().map((a, i) => (
                                                <div
                                                    key={i}
                                                    className={`w-2 rounded-t-sm ${a.isWin ? 'bg-green-500 h-full' : (Math.abs(a.performance) < 0.01 ? 'bg-yellow-500 h-1/2' : 'bg-red-500 h-2/3')}`}
                                                    title={`${a.performance.toFixed(2)}%`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Last Activity</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-xl font-bold flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-muted-foreground" />
                                        {new Date(profile.lastAnalyzed).toLocaleDateString()}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {new Date(profile.lastAnalyzed).toLocaleTimeString()}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Analysis List */}
                        <div>
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                Recent Calls <span className="text-muted-foreground text-sm font-normal">({analyses.length})</span>
                            </h2>
                            {analyses.length === 0 ? (
                                <div className="text-center py-10 border rounded-lg bg-muted/20">
                                    No detailed analysis history available directly.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {analyses.map((analysis) => (
                                        <AnalysisCard key={analysis.id} analysis={analysis} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
