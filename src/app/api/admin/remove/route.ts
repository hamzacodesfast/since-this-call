import { NextRequest, NextResponse } from 'next/server';
import { removeAnalysisByTweetId } from '@/lib/analysis-store';

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const tweetId = searchParams.get('id');
    const adminSecret = request.headers.get('x-admin-secret');

    // Require admin secret for delete operations
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
