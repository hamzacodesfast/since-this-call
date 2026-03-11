'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Shield, Zap,
    Crown, Target, BarChart3, AlertTriangle, Clock, User, ExternalLink, ChevronDown, ChevronUp, Share2, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ─── Types (mirror trader-agent.ts) ───────────────────────────────────────────

interface EnhancedMetrics {
    tickerWinRate: number | null;
    tickerCalls: number;
    recentWinRate: number;
    recentStreak: string;
    avgConviction: number;
    callConviction: number;
    momentum: 'HOT' | 'COLD' | 'NEUTRAL';
}

interface SourceAccount {
    username: string;
    winRate: number;
    totalCalls: number;
    latestCall: {
        id: string;
        symbol: string;
        sentiment: string;
        performance: number;
        timestamp: number;
        text?: string;
    };
    enhanced?: EnhancedMetrics;
}

interface TradeRecommendation {
    playbook: string;
    signal: 'FADE' | 'COPY' | 'MEAN_REVERSION' | 'MOMENTUM' | 'MAX_CONVICTION';
    direction: 'LONG' | 'SHORT';
    ticker: string;
    tickerType: 'CRYPTO' | 'STOCK';
    confidence: 'LOW' | 'MEDIUM' | 'HIGH' | 'APEX';
    reasoning: string;
    sourceAccounts: SourceAccount[];
    timestamp: number;
    staleness: string;
    riskWarnings: string[];
}

interface TraderScanResult {
    scanTimestamp: number;
    farmerFades: TradeRecommendation[];
    silentSnipers: TradeRecommendation[];
    smartMoneyDivergences: TradeRecommendation[];
    sectorRotations: TradeRecommendation[];
    dualSniperSignals: TradeRecommendation[];
    totalSignals: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    FADE: { label: 'FADE', color: 'text-orange-400', icon: RefreshCw },
    COPY: { label: 'COPY TRADE', color: 'text-green-400', icon: Target },
    MEAN_REVERSION: { label: 'MEAN REVERSION', color: 'text-blue-400', icon: BarChart3 },
    MOMENTUM: { label: 'MOMENTUM', color: 'text-purple-400', icon: Zap },
    MAX_CONVICTION: { label: 'MAX CONVICTION', color: 'text-yellow-400', icon: Crown },
};

const CONFIDENCE_CONFIG: Record<string, { label: string; bg: string; text: string; glow: string }> = {
    LOW: { label: 'LOW', bg: 'bg-zinc-700/50', text: 'text-zinc-300', glow: '' },
    MEDIUM: { label: 'MEDIUM', bg: 'bg-yellow-500/20', text: 'text-yellow-400', glow: '' },
    HIGH: { label: 'HIGH', bg: 'bg-green-500/20', text: 'text-green-400', glow: 'shadow-green-500/10 shadow-lg' },
    APEX: { label: 'APEX', bg: 'bg-yellow-500/20', text: 'text-yellow-300', glow: 'shadow-yellow-500/20 shadow-xl ring-1 ring-yellow-500/30' },
};

const PLAYBOOK_SECTIONS = [
    { key: 'dualSniperSignals', title: 'Apex Signals', icon: Crown, color: 'yellow', description: 'Multiple elite predictors converging on the same thesis' },
    { key: 'silentSnipers', title: 'Silent Sniper Follow', icon: Target, color: 'green', description: 'High-accuracy predictors making rare calls' },
    { key: 'smartMoneyDivergences', title: 'Smart Money Divergence', icon: BarChart3, color: 'blue', description: 'Proven winners betting against the crowd' },
    { key: 'sectorRotations', title: 'Sector Rotation', icon: Zap, color: 'purple', description: '24h volume spikes led by quality accounts' },
    { key: 'farmerFades', title: 'Farmer Fades', icon: RefreshCw, color: 'orange', description: 'Counter-trade the most consistently wrong accounts' },
] as const;

// ─── Components ───────────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: string }) {
    const config = SIGNAL_CONFIG[signal] || SIGNAL_CONFIG.FADE;
    const Icon = config.icon;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-bold ${config.color} px-2 py-0.5 rounded-full bg-white/5 border border-white/10`}>
            <Icon className="w-3 h-3" />
            {config.label}
        </span>
    );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
    const config = CONFIDENCE_CONFIG[confidence] || CONFIDENCE_CONFIG.LOW;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>
            {confidence === 'APEX' && '💎 '}
            {config.label}
        </span>
    );
}

function DirectionArrow({ direction }: { direction: 'LONG' | 'SHORT' }) {
    return direction === 'LONG' ? (
        <span className="inline-flex items-center gap-1 text-green-400 font-bold text-sm">
            <TrendingUp className="w-4 h-4" /> LONG
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 text-red-400 font-bold text-sm">
            <TrendingDown className="w-4 h-4" /> SHORT
        </span>
    );
}

function RecommendationCard({ rec }: { rec: TradeRecommendation }) {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        const text = `🚨 STC Signal: ${rec.signal} $${rec.ticker} (${rec.direction})
Confidence: ${rec.confidence}
${rec.reasoning}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const confConfig = CONFIDENCE_CONFIG[rec.confidence] || CONFIDENCE_CONFIG.LOW;
    const borderColor = rec.confidence === 'APEX'
        ? 'border-yellow-500/40'
        : rec.direction === 'LONG'
            ? 'border-green-500/20'
            : 'border-red-500/20';

    return (
        <div
            className={`rounded-xl border ${borderColor} ${confConfig.glow} bg-background/60 backdrop-blur-sm p-4 transition-all hover:bg-background/80 animate-in fade-in-0 slide-in-from-bottom-2 duration-500`}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold tracking-tight">${rec.ticker}</span>
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50 uppercase">{rec.tickerType}</span>
                    <DirectionArrow direction={rec.direction} />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <ConfidenceBadge confidence={rec.confidence} />
                    <SignalBadge signal={rec.signal} />
                    <button onClick={handleShare} className="p-1 rounded-md hover:bg-white/10 transition-colors" title="Share Signal">
                        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />}
                    </button>
                </div>
            </div>

            {/* Reasoning */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{rec.reasoning}</p>

            {/* Source Accounts — V2 Enhanced */}
            <div className="space-y-2 mb-3">
                {rec.sourceAccounts.map((acc) => (
                    <Link
                        key={acc.username}
                        href={`/user/${acc.username}`}
                        className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors group border border-transparent hover:border-border"
                    >
                        <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium group-hover:text-foreground">@{acc.username}</span>
                            <span className={`font-bold ${acc.winRate > 60 ? 'text-green-400' : acc.winRate < 35 ? 'text-red-400' : 'text-yellow-400'}`}>
                                {acc.winRate.toFixed(1)}%
                            </span>
                            <span className="text-muted-foreground">{acc.totalCalls}c</span>
                            <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        {acc.enhanced && (
                            <div className="flex items-center gap-2 text-[10px]">
                                {acc.enhanced.tickerWinRate !== null && (
                                    <span className={`px-1.5 py-0.5 rounded ${acc.enhanced.tickerWinRate > 60 ? 'bg-green-500/15 text-green-400' : acc.enhanced.tickerWinRate < 35 ? 'bg-red-500/15 text-red-400' : 'bg-muted/50 text-muted-foreground'}`}>
                                        ${rec.ticker}: {acc.enhanced.tickerWinRate.toFixed(0)}%
                                    </span>
                                )}
                                <span className={`px-1.5 py-0.5 rounded ${acc.enhanced.momentum === 'HOT' ? 'bg-orange-500/15 text-orange-400' : acc.enhanced.momentum === 'COLD' ? 'bg-blue-500/15 text-blue-400' : 'bg-muted/50 text-muted-foreground'}`}>
                                    {acc.enhanced.recentStreak}
                                </span>
                                {acc.enhanced.callConviction > 0 && acc.enhanced.callConviction !== 0.5 && (
                                    <span className="px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                                        Conv: {(acc.enhanced.callConviction * 100).toFixed(0)}%
                                    </span>
                                )}
                            </div>
                        )}
                    </Link>
                ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {rec.staleness}
                </span>
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                    <AlertTriangle className="w-3 h-3" />
                    Risks
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
            </div>

            {/* Risk Warnings (Collapsible) */}
            {expanded && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                    {rec.riskWarnings.map((w, i) => (
                        <p key={i} className="text-[11px] text-yellow-500/80 flex items-start gap-1.5">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            {w}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}

function PlaybookSection({ title, icon: Icon, color, description, recommendations }: {
    title: string;
    icon: any;
    color: string;
    description: string;
    recommendations: TradeRecommendation[];
}) {
    const [collapsed, setCollapsed] = useState(false);
    const colorClasses: Record<string, { text: string; border: string; bg: string }> = {
        yellow: { text: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/5' },
        green: { text: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/5' },
        blue: { text: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/5' },
        purple: { text: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/5' },
        orange: { text: 'text-orange-400', border: 'border-orange-500/20', bg: 'bg-orange-500/5' },
    };
    const c = colorClasses[color] || colorClasses.green;

    return (
        <Card className={`${c.border} bg-background/40 backdrop-blur-sm`}>
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${c.text}`} />
                        <span className={c.text}>{title}</span>
                        <span className="text-xs text-muted-foreground font-normal ml-1">
                            ({recommendations.length} signal{recommendations.length !== 1 ? 's' : ''})
                        </span>
                    </div>
                    {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardHeader>
            {!collapsed && (
                <CardContent className="space-y-3 pt-2">
                    {recommendations.length === 0 ? (
                        <div className="text-center text-muted-foreground py-6 text-sm">No signals detected for this playbook</div>
                    ) : (
                        recommendations.map((rec, i) => (
                            <RecommendationCard key={`${rec.ticker}-${rec.signal}-${i}`} rec={rec} />
                        ))
                    )}
                </CardContent>
            )}
        </Card>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TraderPage() {
    const [data, setData] = useState<TraderScanResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async (force = false) => {
        try {
            if (force) setRefreshing(true);
            const url = force ? '/api/signals?refresh=true' : '/api/signals';
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setData(json);
            setError(null);
        } catch (e) {
            console.error('Failed to fetch signals data:', e);
            setError('Failed to load scan results. Make sure the server is running.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => fetchData(), 5 * 60 * 1000); // 5 min auto-refresh
        return () => clearInterval(interval);
    }, [fetchData]);

    return (
        <main className="min-h-screen bg-background relative overflow-hidden">
            {/* Ambient Glow Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[5%] left-[10%] w-[40%] h-[40%] bg-yellow-500/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[10%] right-[10%] w-[35%] h-[35%] bg-purple-500/5 rounded-full blur-[120px]" />
                <div className="absolute top-[50%] left-[50%] w-[30%] h-[30%] bg-green-500/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
            </div>

            <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                                <Shield className="w-6 h-6 text-yellow-400" />
                                Signals
                            </h1>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                High-Probability Recommendation Engine
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        className="gap-2"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Scanning...' : 'Refresh'}
                    </Button>
                </div>

                {/* Risk Disclaimer */}
                <div className="mb-6 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-yellow-400/90 leading-relaxed">
                            <strong>DISCLAIMER:</strong> These are data-driven observations from STC&apos;s prediction tracking database, not financial advice.
                            Every recommendation carries risk. Never risk more than 2-3% of portfolio on any single signal.
                            Confluence is King — signals are strongest when multiple playbooks align.
                        </div>
                    </div>
                </div>


                {/* Scan Summary Bar */}
                {data && !loading && (
                    <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-border/50 bg-background/60 p-3 text-center">
                            <div className="text-2xl font-bold">{data.totalSignals}</div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Signals</div>
                        </div>
                        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-center">
                            <div className="text-2xl font-bold text-green-400">{data.silentSnipers.length}</div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Sniper Follows</div>
                        </div>
                        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 text-center">
                            <div className="text-2xl font-bold text-orange-400">{data.farmerFades.length}</div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Farmer Fades</div>
                        </div>
                        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-center">
                            <div className="text-2xl font-bold text-yellow-400">{data.dualSniperSignals.length}</div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Apex Signals</div>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-40 bg-muted/30 rounded-xl animate-pulse" />
                        ))}
                        <div className="text-center text-muted-foreground text-sm mt-4">
                            Running full market scan across all playbooks...
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && !loading && (
                    <Card className="border-red-500/30 bg-red-500/5">
                        <CardContent className="p-6 text-center">
                            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                            <p className="text-red-400 font-medium mb-1">Scan Failed</p>
                            <p className="text-sm text-muted-foreground mb-3">{error}</p>
                            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchData(true); }}>
                                Retry
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Playbook Sections */}
                {data && !loading && !error && (
                    <div className="space-y-6">
                        {PLAYBOOK_SECTIONS.map((section) => (
                            <PlaybookSection
                                key={section.key}
                                title={section.title}
                                icon={section.icon}
                                color={section.color}
                                description={section.description}
                                recommendations={(data as any)[section.key] || []}
                            />
                        ))}
                    </div>
                )}

                {/* Scan Timestamp */}
                {data && !loading && (
                    <div className="mt-8 text-center text-xs text-muted-foreground">
                        Last scanned: {new Date(data.scanTimestamp).toLocaleString()} · Auto-refreshes every 5 minutes
                    </div>
                )}
            </div>
        </main>
    );
}
