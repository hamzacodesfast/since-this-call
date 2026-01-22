'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';

interface LeaderboardBarProps {
    data: {
        username: string;
        winRate: number;
        totalCalls: number;
    }[];
    isTop?: boolean; // true = green (best), false = red (worst)
}

export function LeaderboardBar({ data, isTop = true }: LeaderboardBarProps) {
    const color = isTop ? '#22c55e' : '#ef4444';

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                No qualified profiles yet
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={250}>
            <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
            >
                <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    stroke="#6b7280"
                    fontSize={12}
                />
                <YAxis
                    type="category"
                    dataKey="username"
                    stroke="#6b7280"
                    fontSize={12}
                    tickFormatter={(value) => `@${value.slice(0, 10)}${value.length > 10 ? '…' : ''}`}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                    }}
                    labelFormatter={(label) => `@${label}`}
                />
                <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                    {data.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={color}
                            fillOpacity={1 - (index * 0.08)}
                        />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
