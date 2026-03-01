'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, Search, Trophy, TrendingUp, Loader2 } from 'lucide-react';
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
    const [trendingTickers, setTrendingTickers] = useState<TickerProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const observer = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading || loadingMore) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => prevPage + 1);
            }
        });

        if (node) observer.current.observe(node);
    }, [loading, loadingMore, hasMore]);

    const fetchTrending = async () => {
        try {
            const metricsRes = await fetch('/api/metrics');
            const metricsData = await metricsRes.json();

            if (metricsData.topTickers) {
                // Fetch just enough to cover trending requirements (we assume top 20 is enough to find 4)
                const topRes = await fetch('/api/tickers?limit=20');
                const topData = await topRes.json();
                const topProfiles: TickerProfile[] = topData.profiles || [];

                const profileMap = new Map<string, TickerProfile>();
                topProfiles.forEach(p => {
                    const existing = profileMap.get(p.symbol);
                    if (!existing ||
                        (p.type === 'CRYPTO' && existing.type !== 'CRYPTO') ||
                        (p.type === existing.type && p.totalAnalyses > existing.totalAnalyses)) {
                        profileMap.set(p.symbol, p);
                    }
                });

                const trending = metricsData.topTickers
                    .map((t: any) => profileMap.get(t.symbol))
                    .filter((p: TickerProfile | undefined) => p !== undefined)
                    .slice(0, 4);

                setTrendingTickers(trending as TickerProfile[]);
            }
        } catch (e) {
            console.error('Failed to fetch trending tickers:', e);
        }
    };

    // Initial load and search changes
    useEffect(() => {
        const fetchTickers = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    page: '1',
                    limit: '40'
                });
                if (search.trim()) params.append('search', search.trim());

                const res = await fetch(`/api/tickers?${params.toString()}`);
                const data = await res.json();

                setProfiles(data.profiles || []);
                setHasMore(data.hasMore ?? false);
                setPage(1);
            } catch (e) {
                console.error('Failed to fetch ticker data:', e);
            } finally {
                setLoading(false);
            }
        };

        // Debounce search
        const timeoutId = setTimeout(() => {
            fetchTickers();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [search]);

    // Initial load only specific side effects
    useEffect(() => {
        fetchTrending();
    }, []);

    // Load more pages
    useEffect(() => {
        if (page === 1) return; // Handled by search effect

        const loadMore = async () => {
            setLoadingMore(true);
            try {
                const params = new URLSearchParams({
                    page: page.toString(),
                    limit: '40'
                });
                if (search.trim()) params.append('search', search.trim());

                const res = await fetch(`/api/tickers?${params.toString()}`);
                const data = await res.json();

                setProfiles(prev => [...prev, ...(data.profiles || [])]);
                setHasMore(data.hasMore ?? false);
            } catch (e) {
                console.error('Failed to load more tickers:', e);
            } finally {
                setLoadingMore(false);
            }
        };

        loadMore();
    }, [page]);

    // Used for the manual refresh button
    const handleRefresh = () => {
        setSearch('');
        setPage(1);
        fetchTrending();
        // The fetch for profiles happens automatically as search change resets it,
        // but if it's already empty we force fetch here.
        if (search === '') {
            setLoading(true);
            fetch(`/api/tickers?page=1&limit=40`)
                .then(res => res.json())
                .then(data => {
                    setProfiles(data.profiles || []);
                    setHasMore(data.hasMore ?? false);
                })
                .finally(() => setLoading(false));
        }
    };

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
                            Tracked Tickers
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
                        <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading || loadingMore}>
                            <RefreshCw className={`w-4 h-4 ${(loading || loadingMore) ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                {/* Trending Section */}
                {!search && !loading && trendingTickers.length > 0 && (
                    <div className="mb-12">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-amber-500" />
                            Trending Tickers
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            {trendingTickers.map((profile) => (
                                <TickerCard key={`trending-${profile.symbol}`} ticker={profile} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : profiles.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground">
                        No tickers found matching "{search}"
                    </div>
                ) : (
                    <>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            All Tickers
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {profiles.map((profile, index) => {
                                const isLastElement = index === profiles.length - 1;
                                return (
                                    <div key={`${profile.type}:${profile.symbol}-${index}`} ref={isLastElement ? lastElementRef : null}>
                                        <TickerCard ticker={profile} />
                                    </div>
                                );
                            })}
                        </div>

                        {loadingMore && (
                            <div className="mt-8 flex justify-center pb-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
