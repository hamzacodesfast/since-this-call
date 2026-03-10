import { NextResponse } from 'next/server';
import { getAsterClient } from '@/lib/aster-client';
import { calculateIndicators } from '@/lib/technical-analysis';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const symbol = searchParams.get('symbol');
        const interval = searchParams.get('interval') || '1h';
        const limit = parseInt(searchParams.get('limit') || '100');

        if (!symbol) {
            return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
        }

        const aster = getAsterClient();
        
        // Try futures first, then spot
        let klines;
        try {
            klines = await aster.getFuturesKlines(symbol, interval, limit);
        } catch (e) {
            console.warn(`[HistoryAPI] Futures klines failed for ${symbol}, trying spot...`);
            klines = await aster.getSpotKlines(symbol, interval, limit);
        }

        if (!klines || klines.length === 0) {
            return NextResponse.json({ error: 'No data found' }, { status: 404 });
        }

        const prices = klines.map(k => parseFloat(k.close));
        const indicators = calculateIndicators(prices);

        const chartData = klines.map((k, i) => ({
            time: k.openTime,
            open: parseFloat(k.open),
            high: parseFloat(k.high),
            low: parseFloat(k.low),
            close: parseFloat(k.close),
            volume: parseFloat(k.volume),
            rsi: indicators.rsi[i],
            sma20: indicators.sma20[i],
            sma50: indicators.sma50[i],
        }));

        return NextResponse.json({
            symbol,
            interval,
            data: chartData
        });

    } catch (error: any) {
        console.error('[HistoryAPI] Failed to fetch history:', error);
        return NextResponse.json(
            { error: 'Failed to fetch historical data', details: error.message },
            { status: 500 }
        );
    }
}
