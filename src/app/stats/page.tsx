'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, TrendingUp, Users, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlatformStats } from '@/components/charts/platform-stats';

interface StatsData {
    totalAnalyses: number;
    totalWins: number;
    totalLosses: number;
    totalProfiles: number;
    bullishCalls: number;
    bearishCalls: number;
    cryptoCalls: number;
    stockCalls: number;
}

export default function StatsPage() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);

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
                    <>
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

                        {/* Quick Links */}
                        <div className="flex flex-wrap gap-4 justify-center">
                            <Link href="/leaderboard">
                                <Button variant="outline">View Leaderboard</Button>
                            </Link>
                            <Link href="/recent">
                                <Button variant="outline">Recent Analyses</Button>
                            </Link>
                            <Link href="/profiles">
                                <Button variant="outline">All Profiles</Button>
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
