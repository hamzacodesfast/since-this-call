
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, User, Trophy, XCircle, TrendingUp, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface UserProfile {
    username: string;
    avatar: string;
    totalAnalyses: number;
    wins: number;
    losses: number;
    neutral: number;
    winRate: number;
    lastAnalyzed: number;
}

export default function ProfilesPage() {
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [filteredProfiles, setFilteredProfiles] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const fetchProfiles = async () => {
            try {
                const res = await fetch('/api/profiles');
                const data = await res.json();
                setProfiles(data.profiles || []);
                setFilteredProfiles(data.profiles || []);
            } catch (e) {
                console.error('Failed to fetch profiles:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchProfiles();
    }, []);

    useEffect(() => {
        if (!search.trim()) {
            setFilteredProfiles(profiles);
            return;
        }
        const term = search.toLowerCase();
        setFilteredProfiles(profiles.filter(p => p.username.toLowerCase().includes(term)));
    }, [search, profiles]);

    return (
        <main className="min-h-screen bg-background relative overflow-hidden">
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] bg-blue-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[10%] right-[20%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                        </Link>
                        <h1 className="text-3xl font-bold tracking-tight">Trader Profiles</h1>
                    </div>
                    <div className="w-full max-w-xs relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search username..."
                            className="pl-9 bg-background/50 backdrop-blur"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-48 bg-muted/50 rounded-xl" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProfiles.map((p) => (
                            <Link key={p.username} href={`/user/${p.username}`}>
                                <Card className="h-full hover:scale-[1.02] transition-all cursor-pointer border-2 border-border/50 bg-background/40 hover:bg-background/60 hover:border-primary/20 group">
                                    <CardContent className="p-6">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="relative">
                                                {p.avatar ? (
                                                    <img src={p.avatar} alt={p.username} className="w-16 h-16 rounded-full border-2 border-border" />
                                                ) : (
                                                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                                        <User className="w-8 h-8 text-muted-foreground" />
                                                    </div>
                                                )}
                                                <div className={`absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-background shadow-sm ${p.winRate >= 50 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                                    {p.winRate.toFixed(0)}% WR
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-lg truncate group-hover:text-primary transition-colors">@{p.username}</div>
                                                <div className="text-muted-foreground text-sm flex items-center gap-1">
                                                    <Trophy className="w-3 h-3 text-yellow-500" />
                                                    {p.totalAnalyses} Calls
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                                            <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                                                <div className="font-bold text-green-500">{p.wins}</div>
                                                <div className="text-[10px] uppercase text-muted-foreground">Wins</div>
                                            </div>
                                            <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                                                <div className="font-bold text-red-500">{p.losses}</div>
                                                <div className="text-[10px] uppercase text-muted-foreground">Losses</div>
                                            </div>
                                            <div className="p-2 rounded bg-muted/50 border border-white/5">
                                                <div className="font-bold text-muted-foreground">{p.neutral}</div>
                                                <div className="text-[10px] uppercase text-muted-foreground">Flat</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
