
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, Search, Trophy, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TickerCard } from '@/components/ticker-card';
import { AsterDexBanner } from '@/components/asterdex-banner';
import NextImage from 'next/image';

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

export default function TickersPage() {
    const [profiles, setProfiles] = useState<TickerProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const fetchProfiles = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/tickers');
            const data = await res.json();
            setProfiles(data.profiles || []);
        } catch (e) {
            console.error('Failed to fetch ticker profiles:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const filtered = profiles.filter(p =>
        p.symbol.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <main className="min-h-screen bg-background relative overflow-hidden">
            {/* Background gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 container mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <NextImage
                            src="/logo.png"
                            alt="SinceThisCall"
                            width={32}
                            height={32}
                            className="rounded"
                        />
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            tracked tickers <span className="text-muted-foreground text-base font-normal">({profiles.length})</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search symbol..."
                                className="pl-9"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="icon" onClick={fetchProfiles} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                {/* Trending Section */}
                {!search && !loading && profiles.length > 0 && (
                    <div className="mb-12">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-amber-500" />
                            Trending Now
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            {[...profiles]
                                .sort((a, b) => b.lastAnalyzed - a.lastAnalyzed)
                                .slice(0, 4)
                                .map((profile) => (
                                    <TickerCard key={`trending-${profile.symbol}`} ticker={profile} />
                                ))
                            }
                        </div>
                    </div>
                )}

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground">
                        No tickers found matching "{search}"
                    </div>
                ) : (
                    <>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            All Tickers
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filtered.map((profile) => (
                                <TickerCard key={`${profile.type}:${profile.symbol}`} ticker={profile} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
