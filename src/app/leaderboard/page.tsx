'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy, Skull, TrendingUp, TrendingDown, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UserProfile {
    username: string;
    avatar: string;
    totalAnalyses: number;
    wins: number;
    losses: number;
    neutral: number;
    winRate: number;
}

export default function LeaderboardPage() {
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfiles = async () => {
            try {
                const res = await fetch('/api/profiles');
                const data = await res.json();
                setProfiles(data.profiles || []);
            } catch (e) {
                console.error('Failed to fetch profiles:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchProfiles();
    }, []);

    // Filter to min 2 calls and sort
    const qualified = profiles.filter(p => p.totalAnalyses >= 2);
    const top10 = [...qualified].sort((a, b) => b.winRate - a.winRate || b.totalAnalyses - a.totalAnalyses).slice(0, 10);
    const worst10 = [...qualified].sort((a, b) => a.winRate - b.winRate || b.totalAnalyses - a.totalAnalyses).slice(0, 10);

    const ProfileRow = ({ p, rank, isTop }: { p: UserProfile; rank: number; isTop: boolean }) => (
        <Link href={`/user/${p.username}`} className="block">
            <div className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:scale-[1.01] ${isTop ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40' : 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${rank <= 3 ? (isTop ? 'bg-yellow-500 text-black' : 'bg-red-600 text-white') : 'bg-muted text-muted-foreground'}`}>
                    {rank}
                </div>
                <div className="relative">
                    {p.avatar ? (
                        <img src={p.avatar} alt={p.username} className="w-10 h-10 rounded-full border border-border" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-5 h-5 text-muted-foreground" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">@{p.username}</div>
                    <div className="text-xs text-muted-foreground">{p.totalAnalyses} calls</div>
                </div>
                <div className="text-right">
                    <div className={`font-bold ${isTop ? 'text-green-500' : 'text-red-500'}`}>
                        {p.winRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {p.wins}W / {p.losses}L
                    </div>
                </div>
            </div>
        </Link>
    );

    return (
        <main className="min-h-screen bg-background relative overflow-hidden">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] bg-green-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[10%] right-[20%] w-[30%] h-[30%] bg-red-500/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
                </div>

                {loading ? (
                    <div className="grid md:grid-cols-2 gap-8 animate-pulse">
                        <div className="h-[600px] bg-muted/50 rounded-xl" />
                        <div className="h-[600px] bg-muted/50 rounded-xl" />
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Top 10 */}
                        <Card className="border-green-500/20 bg-background/40">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2 text-green-500">
                                    <Trophy className="w-5 h-5" />
                                    Top 10 Gurus
                                    <TrendingUp className="w-4 h-4 ml-auto" />
                                </CardTitle>
                                <p className="text-xs text-muted-foreground">Minimum 2 calls required</p>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {top10.map((p, i) => (
                                    <ProfileRow key={p.username} p={p} rank={i + 1} isTop={true} />
                                ))}
                                {top10.length === 0 && (
                                    <div className="text-center text-muted-foreground py-8">No qualified profiles yet</div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Worst 10 */}
                        <Card className="border-red-500/20 bg-background/40">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2 text-red-500">
                                    <Skull className="w-5 h-5" />
                                    Bottom 10 Gurus
                                    <TrendingDown className="w-4 h-4 ml-auto" />
                                </CardTitle>
                                <p className="text-xs text-muted-foreground">Fade signal?</p>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {worst10.map((p, i) => (
                                    <ProfileRow key={p.username} p={p} rank={i + 1} isTop={false} />
                                ))}
                                {worst10.length === 0 && (
                                    <div className="text-center text-muted-foreground py-8">No qualified profiles yet</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                <div className="mt-8 text-center">
                    <Link href="/profiles">
                        <Button variant="outline">
                            View All Profiles
                        </Button>
                    </Link>
                </div>
            </div>
        </main>
    );
}
