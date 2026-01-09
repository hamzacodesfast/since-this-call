
import { Metadata } from 'next';
import { analyzeTweet } from '@/lib/analyzer';
import { AnalysisView } from '@/components/analysis-view';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PageProps {
    params: { id: string };
}

export const runtime = 'edge';

// Dynamic Metadata for Social Sharing
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    try {
        const data = await analyzeTweet(params.id);
        const isWin = data.analysis.sentiment === 'BULLISH'
            ? data.market.performance > 0
            : data.market.performance < 0;

        const title = `${isWin ? '✅ WIN' : '❌ REKT'}: ${data.analysis.symbol} Call by @${data.tweet.username}`;
        const description = `Performance: ${(data.market.performance > 0 ? '+' : '')}${data.market.performance.toFixed(2)}%. Verified by SinceThisCall.com`;

        return {
            title,
            description,
            openGraph: {
                title,
                description,
                images: [`/api/og?id=${params.id}`],
            },
            twitter: {
                card: 'summary_large_image',
                title,
                description,
                images: [`/api/og?id=${params.id}`],
            }
        };
    } catch (e) {
        return {
            title: 'Analysis Not Found | Since This Call',
            description: 'Check crypto and stock predictions.'
        };
    }
}

export default async function AnalysisPage({ params }: PageProps) {
    let data;
    let error;

    try {
        data = await analyzeTweet(params.id);
    } catch (e: any) {
        error = e.message;
    }

    return (
        <main className="min-h-screen bg-background flex flex-col items-center py-12 px-4 relative overflow-hidden text-center">
            {/* Dynamic Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse delay-700" />
            </div>

            {/* Header */}
            <div className="mb-8">
                <Link href="/">
                    <Badge variant="secondary" className="px-4 py-1.5 text-xs font-medium uppercase tracking-widest bg-secondary/50 backdrop-blur-md border border-primary/10 hover:bg-secondary/70 transition-colors cursor-pointer">
                        <Sparkles className="w-3 h-3 mr-2 text-yellow-500" />
                        Since This Call
                    </Badge>
                </Link>
            </div>

            {error ? (
                <div className="mt-12 p-8 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 max-w-lg">
                    <h2 className="text-2xl font-bold mb-2">Analysis Failed</h2>
                    <p>{error}</p>
                    <Link href="/">
                        <Button className="mt-6" variant="destructive">Try Another</Button>
                    </Link>
                </div>
            ) : (
                <div className="w-full">
                    {/* Edited Warning Banner */}
                    {data?.tweet.isEdited && (
                        <div className="max-w-2xl mx-auto mb-6 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 flex items-center justify-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Warning: This tweet was edited. The prediction accuracy may be compromised.</span>
                        </div>
                    )}

                    <AnalysisView data={data!} />

                    <div className="mt-12">
                        <Link href="/">
                            <Button size="lg" variant="outline" className="rounded-xl px-8 border-white/10 hover:bg-white/5">
                                Check Another Prediction
                            </Button>
                        </Link>
                    </div>
                </div>
            )}
        </main>
    );
}
