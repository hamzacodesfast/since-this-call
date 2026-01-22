'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

interface PlatformStatsProps {
    stats: {
        totalAnalyses: number;
        totalWins: number;
        totalLosses: number;
        bullishCalls: number;
        bearishCalls: number;
        cryptoCalls: number;
        stockCalls: number;
    };
}

const COLORS = {
    wins: '#22c55e',
    losses: '#ef4444',
    bullish: '#22c55e',
    bearish: '#ef4444',
    crypto: '#8b5cf6',
    stock: '#3b82f6',
};

export function PlatformStats({ stats }: PlatformStatsProps) {
    const winLossData = [
        { name: 'Wins', value: stats.totalWins, color: COLORS.wins },
        { name: 'Losses', value: stats.totalLosses, color: COLORS.losses },
    ].filter(d => d.value > 0);

    const sentimentData = [
        { name: 'Bullish', value: stats.bullishCalls, color: COLORS.bullish },
        { name: 'Bearish', value: stats.bearishCalls, color: COLORS.bearish },
    ].filter(d => d.value > 0);

    const typeData = [
        { name: 'Crypto', value: stats.cryptoCalls, color: COLORS.crypto },
        { name: 'Stocks', value: stats.stockCalls, color: COLORS.stock },
    ].filter(d => d.value > 0);

    const total = stats.totalWins + stats.totalLosses;
    const winRate = total > 0 ? ((stats.totalWins / total) * 100).toFixed(1) : '0';

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Win/Loss Chart */}
            <div className="p-4 rounded-xl bg-card/50 border">
                <h3 className="text-sm font-semibold mb-2 text-center">Platform Win Rate</h3>
                <div className="relative">
                    <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                            <Pie
                                data={winLossData}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={55}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {winLossData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                        <div className="text-lg font-bold">{winRate}%</div>
                    </div>
                </div>
                <div className="text-center text-xs text-muted-foreground">{total} total calls</div>
            </div>

            {/* Sentiment Distribution */}
            <div className="p-4 rounded-xl bg-card/50 border">
                <h3 className="text-sm font-semibold mb-2 text-center">Sentiment</h3>
                <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                        <Pie
                            data={sentimentData}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={55}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {sentimentData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {/* Asset Type Distribution */}
            <div className="p-4 rounded-xl bg-card/50 border">
                <h3 className="text-sm font-semibold mb-2 text-center">Asset Types</h3>
                <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                        <Pie
                            data={typeData}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={55}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {typeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
