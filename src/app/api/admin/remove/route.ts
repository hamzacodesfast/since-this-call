import { NextRequest, NextResponse } from 'next/server';
import { removeAnalysisByTweetId } from '@/lib/analysis-store';

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const tweetId = searchParams.get('id');

    if (!tweetId) {
        return NextResponse.json({ error: 'Missing tweet ID' }, { status: 400 });
    }

    const success = await removeAnalysisByTweetId(tweetId);

    if (success) {
        return NextResponse.json({ message: `Removed tweet ${tweetId}` });
    } else {
        return NextResponse.json({ error: 'Tweet not found' }, { status: 404 });
    }
}
