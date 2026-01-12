import { Tweet } from 'react-tweet';
import { Quote, TrendingUp, TrendingDown, Calendar, DollarSign, Share, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


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
            avatar?: string;
            date: string;
            isEdited?: boolean;
        };
    };
}

export function AnalysisView({ data }: AnalysisViewProps) {
    const isProfitable = data.market.performance >= 0;
    const isBullish = data.analysis.sentiment === 'BULLISH'; // User wanted it to go UP

    // Logic: 
    // Bullish Call + Profit = WIN
    // Bearish Call + Loss (Price dropped) = WIN
    // Bullish Call + Loss = L
    // Bearish Call + Profit (Price rose) = L

    // Note: performance is (Current - Call) / Call.
    // If Price goes DOWN, performance is negative.

    let isWin = false;
    if (data.analysis.sentiment === 'BULLISH') {
        isWin = data.market.performance > 0;
    } else {
        // Bearish means we wanted price to drop (performance < 0)
        isWin = data.market.performance < 0;
    }

    const colorClass = isWin ? 'text-green-500' : 'text-red-500';
    const bgClass = isWin ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20';
    const badgeVariant = isWin ? "default" : "destructive"; // Green (default sort of) or Red

    // Performace string: Always show ABSOLUTE change for formatting, but handle direction
    const absPerformance = Math.abs(data.market.performance);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: price < 1 ? 6 : 2,
        }).format(price);
    };

    const handleShare = async () => {
        const container = document.getElementById('share-card');
        if (!container) return;

        try {
            // Lazy load html2canvas to save memory/bundle size
            const html2canvas = (await import('html2canvas')).default;

            const canvas = await html2canvas(container, {
                backgroundColor: '#030712', // Force dark bg
                scale: 2,
                useCORS: true,
                allowTaint: true
            });

            canvas.toBlob(async (blob) => {
                if (!blob) return;
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    alert("📸 Receipt Copied! Paste it on X.");

                    const text = `Verified by SinceThisCall.com 🧾\n\n${data.analysis.symbol} Call by @${data.tweet.username}:\n${isWin ? '✅ AGED WELL' : '❌ AGED POORLY'} (${Math.abs(data.market.performance).toFixed(2)}% move)\n\nCheck your own prediction 👇`;
                    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
                    window.open(url, '_blank');

                } catch (e) {
                    console.error('Clipboard failed', e);
                    alert("Please allow clipboard access to copy the image.");
                }
            });

        } catch (e) {
            console.error('Screenshot failed', e);
        }
    };

    return (
        <div className="flex flex-col xl:flex-row gap-8 w-full max-w-6xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-8 duration-700">

            {/* Left: Original Tweet (Context) */}
            <div className="flex-1 flex justify-center xl:justify-end">
                <div className="w-full max-w-[500px] tweet-container dark">
                    <Tweet id={data.tweet.id} />
                </div>
            </div>

            {/* Right: The Receipt */}
            <div className="flex-1 flex flex-col items-center xl:items-start justify-center">

                <Card id="share-card" className={cn("w-full max-w-[500px] overflow-hidden border-2 relative backdrop-blur-xl", bgClass)}>
                    {/* Watermark / Branding visible only on share/card */}
                    <div className="absolute top-4 right-4 opacity-10 pointer-events-none">
                        <img src="/logo.png" alt="Watermark" className="w-24 h-24" />
                    </div>

                    <CardHeader className="pb-4 relative z-10">
                        {/* Static Tweet Header */}
                        <div className="mb-4">
                            {/* Top row: Avatar + Name + Badges */}
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-3">
                                    {/* Avatar */}
                                    {data.tweet.avatar ? (
                                        <img
                                            src={data.tweet.avatar}
                                            alt={data.tweet.author}
                                            className="w-12 h-12 rounded-full border border-white/10"
                                            crossOrigin="anonymous"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center border border-white/10">
                                            <Quote className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                    )}

                                    <div className="leading-tight text-left">
                                        <div className="font-bold text-sm flex items-center gap-1.5">
                                            {data.tweet.author}
                                            <span className="text-blue-400 text-[10px]">Verify</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            @{data.tweet.username}
                                            {data.tweet.isEdited && (
                                                <span className="text-yellow-500 text-[10px] ml-2">⚠️ Edited</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Badges row */}
                            <div className="flex gap-3 flex-wrap">
                                <div className={cn(
                                    "inline-flex items-center justify-center rounded-full border overflow-hidden",
                                    "px-4 py-2 text-xs font-semibold leading-none",
                                    data.analysis.sentiment === 'BULLISH' ? "text-green-400 border-green-400/40 bg-green-500/10" : "text-red-400 border-red-400/40 bg-red-500/10"
                                )}>
                                    {data.analysis.sentiment === 'BULLISH' ? <TrendingUp className="w-3.5 h-3.5 mr-2" /> : <TrendingDown className="w-3.5 h-3.5 mr-2" />}
                                    <span>{data.analysis.sentiment}</span>
                                </div>
                                <div className="inline-flex items-center justify-center rounded-full border border-white/30 overflow-hidden px-4 py-2 text-xs font-semibold text-white/80 bg-white/5 leading-none">
                                    <span>{new Date(data.analysis.date).getFullYear()} Call</span>
                                </div>
                            </div>
                        </div>

                        {/* Static Tweet Body */}
                        <div className="text-base font-light text-foreground/90 leading-relaxed mb-4">
                            "{data.tweet.text.length > 140 ? data.tweet.text.slice(0, 140) + '...' : data.tweet.text}"
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-0 relative z-10">

                        {/* Main Verdict */}
                        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-background/40 border border-white/5">
                            <div className="space-y-1 text-left">
                                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Verdict</div>
                                <div className={cn("text-xl font-black italic tracking-tighter flex items-center gap-1", colorClass)}>
                                    {isWin ? (
                                        <>
                                            <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> WIN
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle className="w-5 h-5 flex-shrink-0" /> REKT
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="text-right space-y-1">
                                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Move</div>
                                <div className={cn("text-xl font-black tracking-tighter tabular-nums", colorClass)}>
                                    {data.market.performance > 0 ? '+' : ''}{data.market.performance.toFixed(2)}%
                                </div>
                            </div>
                        </div>

                        {/* Data Grid */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> Cost Basis</div>
                                <div className="text-lg font-mono font-medium tracking-tight whitespace-nowrap">{formatPrice(data.market.callPrice)}</div>
                            </div>
                            <div className="space-y-1 text-right">
                                <div className="text-xs text-muted-foreground">Current Price</div>
                                <div className="text-lg font-mono font-medium tracking-tight whitespace-nowrap">{formatPrice(data.market.currentPrice)}</div>
                            </div>
                        </div>

                    </CardContent>

                    <CardFooter className="pt-4 pb-6 flex justify-between items-center opacity-40 text-[10px] uppercase tracking-widest font-semibold border-t border-white/5 mx-6">
                        <span>SinceThisCall.com</span>
                        <span>#{data.tweet.id.slice(-6)}</span>
                    </CardFooter>
                </Card>

                <Button
                    onClick={handleShare}
                    size="lg"
                    className="mt-8 w-full max-w-[500px] font-bold gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
                >
                    <Share className="w-4 h-4" /> Share Receipt
                </Button>
            </div>
        </div>
    );
}
