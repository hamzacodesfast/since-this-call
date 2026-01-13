import { NextResponse } from 'next/server';
import { getRandomAnalysis } from '@/lib/analysis-store';

export const runtime = 'nodejs';

export async function GET() {
    const analysis = getRandomAnalysis();

    if (!analysis) {
        return NextResponse.json(
            { error: 'No analyses available yet' },
            { status: 404 }
        );
    }

    return NextResponse.json({ analysis });
}
