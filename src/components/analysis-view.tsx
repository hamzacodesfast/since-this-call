import { Tweet } from 'react-tweet';
import { Quote, TrendingUp, TrendingDown, Calendar, DollarSign, ArrowRight, Share } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalysisViewProps {
    data: {
        analysis: {
            symbol: string;
            type: 'CRYPTO' | 'STOCK';
            sentiment: 'BULLISH' | 'BEARISH';
            date: string;
        };
        market: {
            callPrice: number;
            currentPrice: number;
            performance: number;
            currency: string;
        };
        tweet: {
            id: string;
            text: string;
            author: string;
            username: string;
            date: string;
        };
    };
}


import html2canvas from 'html2canvas';

export function AnalysisView({ data }: AnalysisViewProps) {
    const isProfitable = data.market.performance >= 0;
    const isBullish = data.analysis.sentiment === 'BULLISH';

    // formatting currency
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: price < 1 ? 6 : 2,
        }).format(price);
    };

    const percentColor = isProfitable
        ? (isBullish ? 'text-green-500' : 'text-red-500')
        : (isBullish ? 'text-red-500' : 'text-green-500');

    const isWin = (isBullish && data.market.performance > 0) || (!isBullish && data.market.performance < 0);
    const colorClass = isWin ? 'text-green-500' : 'text-red-500';
    const bgClass = isWin ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20';

    const handleShare = async () => {
        const container = document.getElementById('share-container');
        if (!container) return;

        try {
            // 1. Capture the visual card
            const canvas = await html2canvas(container, {
                backgroundColor: null, // Transparent background
                scale: 2, // High res
                useCORS: true, // Attempt to load cross-origin images (avatars, etc.)
                allowTaint: true
            });

            // 2. Convert to blob and write to clipboard
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);

                    // 3. Notify user
                    alert("📸 Image copied to clipboard!\n(Includes both Tweet & Stats)\n\nPaste (Ctrl+V) it into the Tweet composer that opens next.");

                    // 4. Open Twitter Intent
                    const text = `🤯 ${data.analysis.symbol} is ${data.market.performance > 0 ? 'UP' : 'DOWN'} ${data.market.performance.toFixed(2)}% since this call by @${data.tweet.username}!\n\nCheck how your predictions aged 👇`;
                    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
                    window.open(url, '_blank');

                } catch (e) {
                    console.error('Clipboard failed', e);
                    alert("Click 'Share' again, but this time allow clipboard access if prompted!");
                }
            });

        } catch (e) {
            console.error('Screenshot failed', e);
        }
    };

    return (
        <div id="share-container" className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Left: Tweet Embed */}
            <div className="flex-1 flex justify-center lg:justify-end">
                <div className="w-full max-w-[550px] tweet-container dark">
                    <Tweet id={data.tweet.id} />
                </div>
            </div>

            {/* Right: Scorecard */}
            <div className="flex-1 flex flex-col justify-center">
                {/* Visual Card Target - ID removed here as we capture parent */}
                <div className={cn("rounded-3xl border p-8 backdrop-blur-sm", bgClass)}>

                    <div className="flex items-center gap-3 mb-6 opacity-80">
                        <Quote className="w-5 h-5" />
                        <span className="text-sm font-medium uppercase tracking-wider">
                            Since This Call
                        </span>
                    </div>

                    <h2 className="text-2xl font-light mb-2">
                        {data.analysis.symbol} is {data.market.performance > 0 ? 'up' : 'down'}
                    </h2>

                    <div className={cn("text-7xl font-bold tracking-tighter mb-8 tabular-nums", colorClass)}>
                        {data.market.performance > 0 ? '+' : ''}{data.market.performance.toFixed(2)}%
                    </div>

                    <div className="grid grid-cols-2 gap-6 text-sm">
                        <div className="space-y-1">
                            <div className="text-muted-foreground flex items-center gap-2">
                                <Calendar className="w-4 h-4" /> Date
                            </div>
                            <div className="font-medium">
                                {new Date(data.analysis.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-muted-foreground flex items-center gap-2">
                                <DollarSign className="w-4 h-4" /> Price Then
                            </div>
                            <div className="font-medium">
                                {formatPrice(data.market.callPrice)}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-muted-foreground flex items-center gap-2">
                                {isProfitable ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} Price Now
                            </div>
                            <div className="font-medium">
                                {formatPrice(data.market.currentPrice)}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-muted-foreground">Call Type</div>
                            <div className={cn("font-bold inline-flex items-center gap-1", isBullish ? "text-green-500" : "text-red-500")}>
                                {data.analysis.sentiment}
                            </div>
                        </div>
                    </div>

                </div>

                {/* Share Button */}
                <button
                    onClick={handleShare}
                    className="mt-6 w-full py-4 rounded-xl bg-foreground text-background font-bold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                    <Share className="w-5 h-5" />
                    Share Result on X
                </button>
            </div>
        </div>
    );
}
