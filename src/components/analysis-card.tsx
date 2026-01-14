
'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, MinusCircle } from 'lucide-react';

interface AnalysisCardProps {
    analysis: {
        id: string;
        username: string;
        author: string;
        avatar?: string;
        symbol: string;
        sentiment: 'BULLISH' | 'BEARISH';
        performance: number;
        isWin: boolean;
        timestamp: number;
        entryPrice?: number;
        currentPrice?: number;
    };
}

const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

export function AnalysisCard({ analysis }: AnalysisCardProps) {
    const isNeutral = Math.abs(analysis.performance) < 0.01;
    const isWin = analysis.performance > 0;

    return (
        <Card className={`h-full hover:scale-[1.02] transition-transform border-2 relative group overflow-hidden ${isNeutral ? 'border-yellow-500/30 bg-yellow-500/5' : (isWin ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5')}`}>
            {/* Main Click Action (Tweet URL) - Absolute Overlay */}
            <Link
                href={`https://x.com/${analysis.username}/status/${analysis.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 z-10"
                aria-label="View original tweet"
            />

            <CardContent className="p-4 flex flex-col h-full pointer-events-none">
                {/* Header - Make clickable elements pointer-events-auto and z-20 */}
                <div className="flex items-center gap-3 mb-3">
                    {analysis.avatar ? (
                        <img
                            src={analysis.avatar}
                            alt={analysis.author}
                            className="w-10 h-10 rounded-full"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-lg">👤</span>
                        </div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                        <div className="font-semibold truncate">{analysis.author}</div>
                        {/* User Profile Link - High z-index to sit above the card link */}
                        <Link
                            href={`/user/${analysis.username}`}
                            className="text-sm text-muted-foreground hover:text-primary transition-colors pointer-events-auto relative z-20 hover:underscore block w-fit"
                        >
                            @{analysis.username}
                        </Link>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(analysis.timestamp)}
                    </div>
                </div>

                {/* Symbol & Sentiment */}
                <div className="flex items-center gap-2 mb-3">
                    <span className="font-mono font-bold text-lg">{analysis.symbol}</span>
                    <span className={`inline-flex items-center text-xs font-semibold px-2 py-1 rounded-full ${analysis.sentiment === 'BULLISH' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {analysis.sentiment === 'BULLISH' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                        {analysis.sentiment}
                    </span>
                </div>

                {/* Result */}
                <div className="mt-auto space-y-3">
                    {/* Prices */}
                    {(analysis.entryPrice !== undefined && analysis.currentPrice !== undefined) && (
                        <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-bold tracking-wider opacity-80 border-t border-white/5 pt-3">
                            <div className="text-left">
                                <div className="text-muted-foreground/80">ENTRY</div>
                                <div className="font-mono text-sm font-bold text-foreground">${analysis.entryPrice < 1 ? analysis.entryPrice.toFixed(6) : analysis.entryPrice.toFixed(2)}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-muted-foreground/80">CURRENT</div>
                                <div className="font-mono text-sm font-bold text-foreground">${analysis.currentPrice < 1 ? analysis.currentPrice.toFixed(6) : analysis.currentPrice.toFixed(2)}</div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className={`flex items-center gap-1.5 font-bold ${isNeutral ? 'text-yellow-500' : (isWin ? 'text-green-500' : 'text-red-500')}`}>
                            {isNeutral ? <MinusCircle className="w-5 h-5" /> : (isWin ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />)}
                            {isNeutral ? 'NEUTRAL' : (isWin ? 'WIN' : 'REKT')}
                        </div>
                        <div className={`font-mono font-bold ${isNeutral ? 'text-yellow-500' : (isWin ? 'text-green-500' : 'text-red-500')}`}>
                            {analysis.performance > 0 ? '+' : ''}{analysis.performance.toFixed(2)}%
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
