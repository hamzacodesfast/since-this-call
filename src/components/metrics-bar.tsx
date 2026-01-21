'use client';

import { useEffect, useState } from 'react';
import { Users, TrendingUp, BarChart3, Coins } from 'lucide-react';

interface PlatformMetrics {
    totalAnalyses: number;
    uniqueGurus: number;
    winRate: number;
    uniqueTickers: number;
    lastUpdated: number;
}

/**
 * Animated counter component for metrics display
 */
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
    const [displayed, setDisplayed] = useState(0);

    useEffect(() => {
        const duration = 1000; // 1 second animation
        const steps = 30;
        const increment = value / steps;
        let current = 0;

        const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
                setDisplayed(value);
                clearInterval(timer);
            } else {
                setDisplayed(Math.floor(current));
            }
        }, duration / steps);

        return () => clearInterval(timer);
    }, [value]);

    return (
        <span className="tabular-nums">
            {displayed.toLocaleString()}{suffix}
        </span>
    );
}

/**
 * Platform metrics bar displayed on homepage
 * Shows total analyses, gurus tracked, win rate, and tickers
 */
export function MetricsBar() {
    const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMetrics() {
            try {
                const res = await fetch('/api/metrics');
                if (res.ok) {
                    const data = await res.json();
                    setMetrics(data);
                }
            } catch (error) {
                console.error('Failed to fetch metrics:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchMetrics();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-wrap justify-center gap-8 md:gap-12 py-6 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                        <div className="w-12 h-8 bg-muted rounded" />
                        <div className="w-20 h-4 bg-muted rounded" />
                    </div>
                ))}
            </div>
        );
    }

    if (!metrics) return null;

    const stats = [
        {
            icon: BarChart3,
            value: metrics.totalAnalyses,
            label: 'Calls Tracked',
            color: 'text-blue-500',
        },
        {
            icon: Users,
            value: metrics.uniqueGurus,
            label: 'Gurus Exposed',
            color: 'text-purple-500',
        },
        {
            icon: TrendingUp,
            value: metrics.winRate,
            suffix: '%',
            label: 'Avg Win Rate',
            color: 'text-green-500',
        },
        {
            icon: Coins,
            value: metrics.uniqueTickers,
            label: 'Assets Tracked',
            color: 'text-yellow-500',
        },
    ];

    return (
        <div className="w-full max-w-4xl mx-auto mb-12">
            <div className="flex flex-wrap justify-center gap-6 md:gap-10 py-6 px-4 bg-card/40 backdrop-blur-sm rounded-2xl border border-border/30">
                {stats.map((stat, idx) => (
                    <div
                        key={idx}
                        className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2"
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        <div className={`p-2 rounded-lg bg-background/50 ${stat.color}`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-2xl md:text-3xl font-bold tracking-tight">
                                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                            </span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider">
                                {stat.label}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
