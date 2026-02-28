import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-01-27.acacia' as any,
});

export async function POST(req: Request) {
    try {
        const origin = req.headers.get('origin') ||
            (req.headers.get('host') ? `http://${req.headers.get('host')}` : 'http://localhost:3000');
        const body = await req.json().catch(() => ({}));
        const { items } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Missing or invalid cart items' }, { status: 400 });
        }

        const line_items = items.map((item: any) => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.title + (item.variantTitle ? ` - ${item.variantTitle}` : ''),
                    images: item.image ? [item.image] : [],
                },
                unit_amount: item.price,
            },
            quantity: item.quantity,
        }));

        // Compress cart for Stripe metadata (max 500 chars)
        const compressedCart = items.map((i: any) => ({
            p: i.productId,
            v: i.variantId,
            q: i.quantity,
            i: i.image // include image for the receipt page
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            shipping_address_collection: {
                allowed_countries: ['US', 'CA', 'GB'],
            },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: {
                            amount: 500, // $5.00 flat shipping
                            currency: 'usd',
                        },
                        display_name: 'Standard Shipping',
                        delivery_estimate: {
                            minimum: { unit: 'business_day', value: 5 },
                            maximum: { unit: 'business_day', value: 7 },
                        },
                    },
                },
            ],
            line_items,
            mode: 'payment',
            success_url: `${origin}/merch/thank-you?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/merch?canceled=true`,
            metadata: {
                product_type: 'apparel',
                cart_items: JSON.stringify(compressedCart).substring(0, 500)
            }
        });

        return NextResponse.json({ sessionId: session.id, url: session.url });
    } catch (err: any) {
        console.error('Stripe Checkout Error:', err);
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.statusCode || 500 }
        );
    }
}
