import { NextResponse } from 'next/server';
import { getRandomAnalysis } from '@/lib/analysis-store';

export const runtime = 'edge';

export async function GET() {
    const analysis = await getRandomAnalysis();

    if (!analysis) {
        return NextResponse.json(
            { error: 'No analyses available yet' },
            { status: 404 }
        );
    }

    return NextResponse.json({ analysis });
}
