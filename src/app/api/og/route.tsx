
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { analyzeTweet } from '@/lib/analyzer';



export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#030712',
                        color: 'white',
                    }}
                >
                    <div style={{ fontSize: 60, fontWeight: 900, marginBottom: 20 }}>SinceThisCall.com</div>
                    <div style={{ fontSize: 30, color: '#9ca3af' }}>Social Prediction Tracker</div>
                </div>
            ),
            { width: 1200, height: 630 }
        );
    }

    try {
        const data = await analyzeTweet(id);
        const isWin = data.analysis.sentiment === 'BULLISH'
            ? data.market.performance > 0
            : data.market.performance < 0;

        const color = isWin ? '#22c55e' : '#ef4444'; // green-500 : red-500
        const bgColor = isWin ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
        const borderColor = isWin ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#030712',
                        color: 'white',
                        fontFamily: 'sans-serif',
                        padding: 40,
                    }}
                >
                    {/* Background Gradients */}
                    <div style={{ position: 'absolute', top: '-20%', left: '-20%', width: '60%', height: '60%', background: 'rgba(59, 130, 246, 0.2)', filter: 'blur(100px)', borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', bottom: '-20%', right: '-20%', width: '60%', height: '60%', background: 'rgba(168, 85, 247, 0.2)', filter: 'blur(100px)', borderRadius: '50%' }} />

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%',
                            height: '100%',
                            backgroundColor: '#0b0f19', // Slightly lighter than bg
                            border: `2px solid ${borderColor}`,
                            borderRadius: 24,
                            padding: 48,
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Watermark */}
                        <div style={{ position: 'absolute', top: 20, right: 30, opacity: 0.3, fontSize: 24, fontWeight: 700, color: '#9ca3af' }}>SinceThisCall.com</div>

                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
                            {data.tweet.avatar && (
                                <img
                                    src={data.tweet.avatar}
                                    style={{ width: 80, height: 80, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', marginRight: 24 }}
                                />
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: 32, fontWeight: 700 }}>{data.tweet.author}</div>
                                <div style={{ fontSize: 24, color: '#9ca3af' }}>@{data.tweet.username}</div>
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center',
                                    background: isWin ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    padding: '8px 20px',
                                    borderRadius: 999,
                                    border: `1px solid ${isWin ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                                }}>
                                    <div style={{ fontSize: 20, fontWeight: 600, color: isWin ? '#4ade80' : '#f87171', textTransform: 'uppercase' }}>
                                        {data.analysis.sentiment}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', padding: '8px 20px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ fontSize: 20, fontWeight: 600, color: '#d1d5db' }}>{new Date(data.analysis.date).getFullYear()} Call</div>
                                </div>
                            </div>
                        </div>

                        {/* Tweet Text */}
                        <div style={{ fontSize: 28, lineHeight: 1.4, color: '#e5e7eb', marginBottom: 40, height: 120, overflow: 'hidden' }}>
                            "{data.tweet.text.length > 130 ? data.tweet.text.slice(0, 130) + '...' : data.tweet.text}"
                        </div>

                        {/* Results */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', padding: 24, background: bgColor, borderRadius: 24, border: `1px solid ${borderColor}` }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: 20, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Verdict</div>
                                <div style={{ fontSize: 64, fontWeight: 900, fontStyle: 'italic', color: color, display: 'flex', alignItems: 'center' }}>
                                    {isWin ? 'WIN' : 'REKT'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <div style={{ fontSize: 20, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>ROI</div>
                                <div style={{ fontSize: 64, fontWeight: 900, color: color }}>
                                    {data.market.performance > 0 ? '+' : ''}{data.market.performance.toFixed(2)}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
            },
        );
    } catch (e: any) {
        return new ImageResponse(
            (
                <div style={{ width: '100%', height: '100%', background: 'black', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Failed to Generate Receipt
                </div>
            ),
            { width: 1200, height: 630 }
        );
    }
}
