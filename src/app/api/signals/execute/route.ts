import { NextResponse } from 'next/server';
import { getAsterClient } from '@/lib/aster-client';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { symbol, side, suggestedLeverage, type = 'MARKET' } = body;

        if (!symbol || !side) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const aster = getAsterClient();
        
        // 1. Set Leverage
        // Note: In a production environment, you might want to check current leverage first
        // or make this configurable.
        try {
            // Some symbols might not support futures or specific leverage
            // We'll wrap this in a try-catch to allow the order to proceed if leverage is already set
        } catch (e) {
            console.warn(`[Execute] Could not set leverage for ${symbol}:`, e);
        }

        // 2. Place Order
        // For simplicity, we use MARKET orders with the suggested leverage.
        // In a real app, you'd calculate quantity based on risk settings.
        // Here we'll require the user to provide quantity or we'd need a way to calc it.
        // For now, we'll return an error if quantity is missing, 
        // OR we can make a 'DRAFT' mode.
        
        if (!body.quantity) {
            return NextResponse.json({ 
                error: 'Quantity required for execution',
                details: 'The agent has drafted the order parameters, but manual quantity input is required for safety.'
            }, { status: 400 });
        }

        const order = await aster.createFuturesOrder({
            symbol,
            side,
            type,
            quantity: body.quantity,
            leverage: suggestedLeverage
        });

        return NextResponse.json({ success: true, order });
    } catch (error: any) {
        console.error('[ExecuteAPI] Order failed:', error);
        return NextResponse.json(
            { error: 'Order execution failed', details: error.message },
            { status: 500 }
        );
    }
}
