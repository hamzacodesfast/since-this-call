import { notFound } from 'next/navigation';
import { AnalysisCard } from '@/components/analysis-card';
import { getRedisClient } from '@/lib/redis-client';

async function getAnalysisFromRedis(id: string) {
    const redis = getRedisClient();

    // Simplest approach: We need to find the analysis.
    // It's in the user's history list. We could search all, but ideally
    // we should have a flat index. Since we only use this for recent tweets,
    // we'll scan the global recent lists or user timelines.

    // Wait, the API already does this via `analyzeTweet` or from the global
    // platform metrics. Let's proxy to our own API.
    try {
        const HOST = process.env.NEXT_APP_URL || 'http://localhost:3000';
        const res = await fetch(`${HOST}/api/recent`, { cache: 'no-store' });
        const data = await res.json();

        const analyses = data.analyses || [];
        const match = analyses.find((a: any) => a.id === id);

        if (match) return match;

        // If not in standard recent, check flat
        const flatRes = await fetch(`${HOST}/api/analyses/flat`, { cache: 'no-store' });
        const flatData = await flatRes.json();
        const flatMatch = (flatData.calls || []).find((a: any) => a.id === id);

        return flatMatch || null;
    } catch (e) {
        console.error("Failed to fetch receipt data", e);
        return null;
    }
}

export default async function ReceiptPage({ params }: { params: { id: string } }) {
    const analysis = await getAnalysisFromRedis(params.id);

    if (!analysis) {
        return notFound();
    }

    return (
        <main className="min-h-screen bg-[#030712] flex items-center justify-center p-8">
            {/* 
              We wrap it in a specific ID and fixed width so Puppeteer 
              knows exactly what bounding box to screenshot.
            */}
            <div id="receipt-card" className="w-[450px]">
                <AnalysisCard analysis={analysis} />
            </div>
        </main>
    );
}
