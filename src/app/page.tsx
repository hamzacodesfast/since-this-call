import Link from 'next/link';
import { Clock, Trophy, BarChart3, TrendingUp, Sparkles, BadgeAlert, ShieldCheck, HeartPulse, Search } from 'lucide-react';
import { MetricsBar } from '@/components/metrics-bar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import NextImage from 'next/image';
import { HomeAnalyzer } from '@/components/home-analyzer';

export default function Home() {
    return (
        <main className="min-h-screen bg-background flex flex-col items-center py-24 px-4 relative overflow-hidden text-center selection:bg-primary/20">
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse delay-700" />
            </div>

            <div className="mb-12 space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Badge variant="secondary" className="px-4 py-1.5 text-xs font-medium uppercase tracking-widest bg-secondary/50 backdrop-blur-md border border-primary/10 gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    The AI Powered Social Prediction Tracker
                </Badge>
                <h1 className="text-5xl md:text-8xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/40 pb-2">
                    Since This Call
                </h1>
                <h2 className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
                    The Definitive Crypto Influencer Call Tracker & Stock Guru Accountability Tool.
                </h2>
                <p className="text-lg text-foreground/60 max-w-xl mx-auto italic">
                    Stop guessing. Start tracking. Verify every financial prediction with immutable price receipts.
                </p>
            </div>

            <MetricsBar />

            <HomeAnalyzer />

            <section className="w-full max-w-4xl text-left space-y-16 py-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border shadow-sm space-y-4 hover:border-primary/20 transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-xl">Accountability First</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            We use advanced AI to extract precise entries and target prices from social media posts, creating a permanent record of every prediction.
                        </p>
                    </div>
                    <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border shadow-sm space-y-4 hover:border-primary/20 transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-xl">Real-Time PnL</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Every call is marked against real-time market data from Yahoo Finance and CoinGecko, showing exactly how a trade would have performed since the call.
                        </p>
                    </div>
                    <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border shadow-sm space-y-4 hover:border-primary/20 transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
                            <Search className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-xl">Guru Benchmarking</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Compare win rates, average returns, and sentiment tilt across thousands of financial influencers to find the voices that actually matter.
                        </p>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-card/80 to-background border rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Sparkles className="w-32 h-32" />
                    </div>
                    <div className="max-w-2xl space-y-6">
                        <h2 className="text-3xl font-bold tracking-tight">Why Sincethiscall.com?</h2>
                        <p className="text-lg text-muted-foreground">
                            Social media is full of "gurus" who delete their losses and highlight only their wins. We built Since This Call to bring transparency to the financial social web.
                        </p>
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <h4 className="font-bold flex items-center gap-2">
                                    <HeartPulse className="w-4 h-4 text-red-500" />
                                    Transparency
                                </h4>
                                <p className="text-sm text-muted-foreground">No deleted tweets. No hidden losses. Just the tape.</p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-bold flex items-center gap-2">
                                    <BadgeAlert className="w-4 h-4 text-amber-500" />
                                    Risk Awareness
                                </h4>
                                <p className="text-sm text-muted-foreground">See the drawdown and volatility since the call was made.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    <div className="p-8 rounded-2xl bg-card/50 backdrop-blur-sm border shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                            <Sparkles className="w-5 h-5" />
                            <h3 className="font-bold text-lg uppercase tracking-wider">Coverage Intelligence</h3>
                        </div>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li className="flex items-start gap-3">
                                <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                <div>
                                    <strong className="text-foreground block mb-0.5">Equities & ETFs</strong>
                                    <p className="opacity-80 leading-relaxed md:max-w-xs">Full coverage of US Stocks (NYSE/NASDAQ) and major indices ($SPX, $QQQ) via institutional-grade feeds.</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-1 w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                                <div>
                                    <strong className="text-foreground block mb-0.5">Top-Tier Crypto</strong>
                                    <p className="opacity-80 leading-relaxed md:max-w-xs">Major assets listed on CMC and CoinGecko. We focus on liquid markets to ensure accurate price tracking.</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                    <div className="p-8 rounded-2xl bg-card/50 backdrop-blur-sm border shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-amber-500">
                            <BadgeAlert className="w-5 h-5" />
                            <h3 className="font-bold text-lg uppercase tracking-wider">System Constraints</h3>
                        </div>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li className="flex items-start gap-3">
                                <span className="text-amber-500 mt-0.5 font-bold">●</span>
                                <div>
                                    <strong className="text-foreground block mb-0.5">Anti-Hype Filter</strong>
                                    <p className="opacity-80 leading-relaxed md:max-w-xs">We do not track unlisted meme coins, pump.fun launches, or illiquid DEX-only tokens.</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-amber-500 mt-0.5 font-bold">●</span>
                                <div>
                                    <strong className="text-foreground block mb-0.5">Historical Context</strong>
                                    <p className="opacity-80 leading-relaxed md:max-w-xs">Analysis older than 30 days is marked against daily close prices to ensure broad historical accuracy.</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="text-center pt-8">
                    <p className="text-muted-foreground text-sm max-w-2xl mx-auto leading-relaxed">
                        Join thousands of traders using Since This Call to verify the "smart money" on X. Whether it's Bitcoin, Nvidia, or the latest silver breakout, we track it all.
                    </p>
                </div>
            </section>

            <div className="mt-auto py-12 text-center space-y-6">
                <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 px-4">
                    <Link href="/recent" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Recent Analyses
                    </Link>
                    <Link href="/leaderboard" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                        <Trophy className="w-4 h-4" /> Guru Leaderboard
                    </Link>
                    <Link href="/stats" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" /> Global Market Stats
                    </Link>
                    <Link href="/signals" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Signal Engine
                    </Link>
                    <Link href="/profiles" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                        Influencer Profiles
                    </Link>
                </nav>
                <div className="flex items-center justify-center gap-3 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground opacity-40">
                    <TrendingUp className="w-3 h-3" />
                    <span>Real Data • Accountable Signals • Verified Results</span>
                </div>
            </div>
        </main>
    );
}

