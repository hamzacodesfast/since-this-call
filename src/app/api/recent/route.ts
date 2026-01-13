import { NextRequest, NextResponse } from 'next/server';
import { addAnalysis, getRecentAnalyses, StoredAnalysis } from '@/lib/analysis-store';

// Use Node runtime for persistent in-memory storage
export const runtime = 'nodejs';

// GET - Fetch recent analyses
export async function GET() {
    const analyses = getRecentAnalyses(20);
    return NextResponse.json({ analyses });
}

// POST - Save a new analysis
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const analysis: StoredAnalysis = {
            id: body.id,
            username: body.username,
            author: body.author,
            avatar: body.avatar,
            symbol: body.symbol,
            sentiment: body.sentiment,
            performance: body.performance,
            isWin: body.isWin,
            timestamp: Date.now(),
        };

        addAnalysis(analysis);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save analysis' }, { status: 400 });
    }
}
