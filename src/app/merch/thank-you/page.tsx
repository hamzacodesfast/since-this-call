'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { CheckCircle2, Package, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';

function ThankYouContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const { clearCart } = useCart();

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [orderData, setOrderData] = useState<any>(null);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!sessionId) {
            setStatus('error');
            return;
        }

        if (hasFetched.current) return;
        hasFetched.current = true;

        // On successful page load with a session ID, clear their cart!
        clearCart();

        const fetchSession = async () => {
            try {
                const res = await fetch(`/api/stripe/session?session_id=${sessionId}`);
                if (!res.ok) throw new Error('Failed to fetch session');
                const data = await res.json();

                if (data.status === 'paid') {
                    setOrderData(data);
                    setStatus('success');
                } else {
                    setStatus('error');
                }
            } catch (err) {
                console.error(err);
                setStatus('error');
            }
        };

        fetchSession();
    }, [sessionId, clearCart]);

    if (status === 'loading') {
        return (
            <div className="container mx-auto px-4 py-24 flex justify-center items-center min-h-[60vh]">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-muted mb-4"></div>
                    <div className="h-6 w-48 bg-muted rounded mb-2"></div>
                    <div className="h-4 w-64 bg-muted rounded"></div>
                </div>
            </div>
        );
    }

    if (status === 'error' || !orderData) {
        return (
            <div className="container mx-auto px-4 py-24 flex flex-col items-center min-h-[60vh] text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-6">
                    <span className="text-destructive font-bold text-2xl">!</span>
                </div>
                <h1 className="text-3xl font-bold mb-4">Something went wrong</h1>
                <p className="text-muted-foreground mb-8 max-w-md">
                    We couldn't verify your order details. If you made a purchase, please check your email for a receipt or contact support.
                </p>
                <Link href="/merch"><Button>Return to Store</Button></Link>
            </div>
        );
    }

    const { shipping_details } = orderData;
    const address = shipping_details?.address;
    const orderId = sessionId?.slice(-8).toUpperCase();

    return (
        <div className="container mx-auto px-4 py-12 md:py-24 max-w-3xl">
            <div className="flex flex-col items-center text-center mb-12">
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Thank you for your order!</h1>
                <p className="text-xl text-muted-foreground">Order #{orderId}</p>
            </div>

            <Card className="mb-8 border-border/50 bg-card overflow-hidden">
                <div className="bg-muted px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b">
                    <div>
                        <p className="text-sm font-medium text-foreground">Order Confirmed</p>
                        <p className="text-sm text-muted-foreground flex items-center mt-1">
                            <Mail className="w-4 h-4 mr-2" />
                            Receipt sent to {orderData.customer_email}
                        </p>
                    </div>
                    <div className="mt-4 sm:mt-0 font-bold text-lg">
                        Total: ${(orderData.amount_total / 100).toFixed(2)}
                    </div>
                </div>

                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-semibold text-foreground flex items-center mb-4">
                                <Package className="w-4 h-4 mr-2" />
                                Shipping Information
                            </h3>
                            <div className="text-sm text-muted-foreground space-y-1">
                                <p className="font-medium text-foreground">{shipping_details?.name}</p>
                                {address && (
                                    <>
                                        <p>{address.line1}</p>
                                        {address.line2 && <p>{address.line2}</p>}
                                        <p>{address.city}, {address.state} {address.postal_code}</p>
                                        <p>{address.country}</p>
                                    </>
                                )}
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-foreground mb-4">Items Ordered</h3>
                            <div className="space-y-4">
                                {orderData.line_items?.map((item: any) => (
                                    <div key={item.id} className="flex gap-4 items-start pb-4 border-b last:border-0 last:pb-0">
                                        {item.custom_image || item.price?.product?.images?.[0] ? (
                                            <div className="w-12 h-12 relative rounded-md border bg-muted/20 overflow-hidden flex-shrink-0">
                                                <Image
                                                    src={item.custom_image || item.price?.product?.images?.[0]}
                                                    alt={item.description}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 rounded-md border bg-muted/20 flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground">
                                                STC
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground line-clamp-2">{item.description}</p>
                                            <p className="text-xs text-muted-foreground mt-1">Qty: {item.quantity}</p>
                                        </div>
                                        <p className="text-sm font-medium whitespace-nowrap">
                                            ${(item.amount_total / 100).toFixed(2)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-center">
                <Link href="/merch">
                    <Button variant="outline" className="rounded-full px-8">
                        Continue Shopping
                    </Button>
                </Link>
            </div>
        </div>
    );
}

export default function ThankYouPage() {
    return (
        <Suspense fallback={<div className="min-h-screen py-24 text-center">Loading receipt...</div>}>
            <ThankYouContent />
        </Suspense>
    );
}
