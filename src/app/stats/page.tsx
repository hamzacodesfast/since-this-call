'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, TrendingUp, Users, Target, Flame, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlatformStats } from '@/components/charts/platform-stats';
import { AsterDexBanner } from '@/components/asterdex-banner';
import { ScreenshotButton } from '@/components/screenshot-button';
import { Share } from 'lucide-react';

interface TickerStats {
    symbol: string;
    callCount: number;
    bullish: number;
    bearish: number;
    wins: number;
    losses: number;
}

interface StatsData {
    totalAnalyses: number;
    totalWins: number;
    totalLosses: number;
    totalProfiles: number;
    bullishCalls: number;
    bearishCalls: number;
    cryptoCalls: number;
    stockCalls: number;
    topTickers: TickerStats[];
}

export default function StatsPage() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch from metrics API (includes all stats now)
                const metricsRes = await fetch('/api/metrics');
                const metricsData = await metricsRes.json();

                // Fetch profiles count
                const profilesRes = await fetch('/api/profiles');
                const profilesData = await profilesRes.json();

                setStats({
                    totalAnalyses: metricsData.totalAnalyses || 0,
                    totalWins: metricsData.totalWins || 0,
                    totalLosses: metricsData.totalLosses || 0,
                    totalProfiles: profilesData.profiles?.length || 0,
                    bullishCalls: metricsData.bullishCalls || 0,
                    bearishCalls: metricsData.bearishCalls || 0,
                    cryptoCalls: metricsData.cryptoCalls || 0,
                    stockCalls: metricsData.stockCalls || 0,
                    topTickers: metricsData.topTickers || [],
                });
            } catch (e) {
                console.error('Failed to fetch stats:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const winRate = stats && (stats.totalWins + stats.totalLosses) > 0
        ? ((stats.totalWins / (stats.totalWins + stats.totalLosses)) * 100).toFixed(1)
        : '0';

    return (
        <main className="min-h-screen bg-background relative overflow-hidden">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[10%] right-[20%] w-[30%] h-[30%] bg-blue-500/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <BarChart3 className="w-8 h-8" />
                        Platform Stats
                    </h1>
                    <div className="ml-auto">
                        <ScreenshotButton
                            targetId="platform-stats-container"
                            buttonText="Share Platform Alpha"
                            shareText={`Verified by @sincethiscall 🧾\n\nPlatform Performance:\n${winRate}% Win Rate across ${stats?.totalAnalyses} calls! 🚀`}
                            className="bg-blue-600 hover:bg-blue-700"
                            size="sm"
                        />
                    </div>
                </div>

                {/* AsterDex Banner */}
                <div className="mb-8">
                    <AsterDexBanner />
                </div>

                {loading ? (
                    <div className="space-y-6 animate-pulse">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-24 bg-muted/50 rounded-xl" />
                            ))}
                        </div>
                        <div className="h-[200px] bg-muted/50 rounded-xl" />
                    </div>
                ) : stats && (
                    <div id="platform-stats-container" className="space-y-8 p-4 rounded-3xl border border-white/5 bg-black/20">
                        {/* Key Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <Card className="bg-background/40">
                                <CardContent className="pt-6">
                                    <div className="text-center">
                                        <Target className="w-8 h-8 mx-auto mb-2 text-primary" />
                                        <div className="text-3xl font-bold">{stats.totalAnalyses}</div>
                                        <div className="text-sm text-muted-foreground">Total Calls</div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-background/40">
                                <CardContent className="pt-6">
                                    <div className="text-center">
                                        <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
                                        <div className="text-3xl font-bold text-green-500">{winRate}%</div>
                                        <div className="text-sm text-muted-foreground">Win Rate</div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-background/40">
                                <CardContent className="pt-6">
                                    <div className="text-center">
                                        <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                                        <div className="text-3xl font-bold">{stats.totalProfiles}</div>
                                        <div className="text-sm text-muted-foreground">Profiles</div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-background/40">
                                <CardContent className="pt-6">
                                    <div className="text-center">
                                        <div className="flex justify-center gap-2 mb-2">
                                            <span className="text-green-500 text-2xl font-bold">{stats.totalWins}</span>
                                            <span className="text-muted-foreground text-2xl">/</span>
                                            <span className="text-red-500 text-2xl font-bold">{stats.totalLosses}</span>
                                        </div>
                                        <div className="text-sm text-muted-foreground">Wins / Losses</div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Chart Section */}
                        <Card className="bg-background/40 mb-8">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5" />
                                    Distribution Charts
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <PlatformStats stats={stats} />
                            </CardContent>
                        </Card>

                        {/* Top Tickers Section */}
                        {stats.topTickers && stats.topTickers.length > 0 && (
                            <Card className="bg-background/40 mb-8">
                                <CardHeader>
                                    <CardTitle className="flex flex-col md:flex-row md:items-center gap-4 w-full">
                                        <div className="flex items-center gap-2">
                                            <Flame className="w-5 h-5 text-orange-500" />
                                            Most Tracked Tickers
                                        </div>
                                        <div className="relative md:ml-auto w-full md:max-w-xs">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search ticker..."
                                                className="pl-9 h-9 bg-background/50 backdrop-blur"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {(() => {
                                            const filtered = stats.topTickers.filter(t =>
                                                t.symbol.toLowerCase().includes(searchTerm.toLowerCase())
                                            );

                                            if (filtered.length === 0) {
                                                return <div className="text-center py-8 text-muted-foreground italic">No tickers found matching "{searchTerm}"</div>;
                                            }

                                            // If not searching, only show top 10. If searching, show all matches.
                                            const displayList = searchTerm ? filtered : filtered.slice(0, 10);

                                            return displayList.map((ticker, i) => {
                                                const totalCalls = ticker.bullish + ticker.bearish;
                                                const bullishPct = totalCalls > 0 ? Math.round((ticker.bullish / totalCalls) * 100) : 0;
                                                const winRate = (ticker.wins + ticker.losses) > 0
                                                    ? Math.round((ticker.wins / (ticker.wins + ticker.losses)) * 100)
                                                    : 0;
                                                return (
                                                    <div key={ticker.symbol} className="flex items-center gap-4 p-4 rounded-lg border bg-background/20">
                                                        <div className="text-2xl font-bold text-muted-foreground w-8">
                                                            #{i + 1}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-xl font-bold">${ticker.symbol}</span>
                                                                <span className="text-sm text-muted-foreground">
                                                                    {ticker.callCount} calls
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-4 text-sm">
                                                                <span className="text-green-500">
                                                                    📈 {ticker.bullish} bullish ({bullishPct}%)
                                                                </span>
                                                                <span className="text-red-500">
                                                                    📉 {ticker.bearish} bearish ({100 - bullishPct}%)
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className={`text-lg font-bold ${winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                                                                {winRate}% win rate
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {ticker.wins}W / {ticker.losses}L
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Quick Links */}
                        <div className="flex flex-wrap gap-4 justify-center">
                            <Link href="/leaderboard">
                                <Button variant="outline">View Leaderboard</Button>
                            </Link>
                            <Link href="/recent">
                                <Button variant="outline">Recent Analyses</Button>
                            </Link>
                            <Link href="/flat">
                                <Button variant="outline">Flat Calls</Button>
                            </Link>
                            <Link href="/profiles">
                                <Button variant="outline">All Profiles</Button>
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
