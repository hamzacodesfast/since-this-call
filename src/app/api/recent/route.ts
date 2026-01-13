import { NextRequest, NextResponse } from 'next/server';
import { addAnalysis, getRecentAnalyses, StoredAnalysis } from '@/lib/analysis-store';

// Edge runtime works with Upstash Redis REST API
export const runtime = 'edge';

// GET - Fetch recent analyses
export async function GET() {
    const analyses = await getRecentAnalyses(20);
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

        await addAnalysis(analysis);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API Recent] Error:', error);
        return NextResponse.json({ error: 'Failed to save analysis' }, { status: 400 });
    }
}
