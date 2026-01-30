
'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

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

interface TickerCardProps {
    ticker: TickerProfile;
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

export function TickerCard({ ticker }: TickerCardProps) {
    const isProfitable = ticker.winRate > 50;

    return (
        <Link href={`/tickers/${ticker.symbol}`} className="block h-full">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${isProfitable ? 'bg-green-500' : (ticker.winRate < 40 ? 'bg-red-500' : 'bg-yellow-500')}`} />

                <CardHeader className="pb-2 pl-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl font-bold tracking-tight">{ticker.symbol}</CardTitle>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Activity className="w-3 h-3" />
                                {formatTimeAgo(ticker.lastAnalyzed)}
                            </div>
                        </div>
                        <div className={`text-xl font-mono font-bold ${isProfitable ? 'text-green-500' : (ticker.winRate < 40 ? 'text-red-500' : 'text-yellow-500')}`}>
                            {ticker.winRate.toFixed(0)}%
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pl-6 text-sm">
                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="space-y-1">
                            <div className="text-muted-foreground text-xs uppercase tracking-wider">Calls</div>
                            <div className="font-semibold">{ticker.totalAnalyses}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-muted-foreground text-xs uppercase tracking-wider">Record</div>
                            <div className="flex items-center gap-2 text-xs font-mono">
                                <span className="text-green-500 flex items-center"><TrendingUp className="w-3 h-3 mr-0.5" />{ticker.wins}</span>
                                <span className="text-red-500 flex items-center"><TrendingDown className="w-3 h-3 mr-0.5" />{ticker.losses}</span>
                                <span className="text-yellow-500 flex items-center"><Minus className="w-3 h-3 mr-0.5" />{ticker.neutral}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
