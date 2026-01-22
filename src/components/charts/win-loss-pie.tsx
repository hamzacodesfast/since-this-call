'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface WinLossPieProps {
    wins: number;
    losses: number;
    neutral?: number;
}

const COLORS = {
    wins: '#22c55e',    // green-500
    losses: '#ef4444',  // red-500
    neutral: '#eab308', // yellow-500
};

export function WinLossPie({ wins, losses, neutral = 0 }: WinLossPieProps) {
    const data = [
        { name: 'Wins', value: wins, color: COLORS.wins },
        { name: 'Losses', value: losses, color: COLORS.losses },
        ...(neutral > 0 ? [{ name: 'Neutral', value: neutral, color: COLORS.neutral }] : []),
    ].filter(d => d.value > 0);

    const total = wins + losses + neutral;

    if (total === 0) {
        return (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                No calls yet
            </div>
        );
    }

    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0';

    return (
        <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#fff' }}
                    />
                    <Legend
                        formatter={(value, entry: any) => (
                            <span className="text-sm text-foreground">{value}: {entry.payload.value}</span>
                        )}
                    />
                </PieChart>
            </ResponsiveContainer>
            {/* Center stat */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none" style={{ marginTop: '-20px' }}>
                <div className="text-2xl font-bold text-foreground">{winRate}%</div>
                <div className="text-xs text-muted-foreground">Win Rate</div>
            </div>
        </div>
    );
}
