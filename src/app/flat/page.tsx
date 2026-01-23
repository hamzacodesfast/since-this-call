
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, MinusCircle, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnalysisCard } from '@/components/analysis-card';
import { AsterDexBanner } from '@/components/asterdex-banner';

export default function FlatPage() {
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchFlat = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/analyses/flat');
            const data = await res.json();
            setCalls(data.calls || []);
        } catch (e) {
            console.error('Failed to fetch flat calls:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFlat();
    }, []);

    return (
        <main className="min-h-screen bg-background relative overflow-hidden">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] bg-yellow-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[10%] right-[20%] w-[30%] h-[30%] bg-orange-500/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 container mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/stats">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                        </Link>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-yellow-500">
                            <MinusCircle className="w-8 h-8" />
                            Flat / Neutral Calls
                        </h1>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchFlat} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex gap-4 items-start">
                    <AlertTriangle className="w-6 h-6 text-yellow-500 shrink-0 mt-1" />
                    <div>
                        <h3 className="font-bold text-yellow-500">Why are these flat?</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Calls are marked as <strong>FLAT</strong> when their absolute performance is less than 0.05%.
                            This often happens if a token is extremely new, has no market data (like private tokens), or if the Guru called for a "sideways" move.
                        </p>
                    </div>
                </div>

                <AsterDexBanner />

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : calls.length === 0 ? (
                    <div className="text-center py-20">
                        <MinusCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <h2 className="text-xl font-semibold mb-2">No flat calls found</h2>
                        <p className="text-muted-foreground">Everything is moving! 🚀</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {calls.map((analysis: any) => (
                            <AnalysisCard key={`${analysis.id}-${analysis.timestamp}`} analysis={analysis} />
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
