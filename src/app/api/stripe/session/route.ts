import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY as string) || '', {
    apiVersion: '2025-01-27.acacia' as any,
});

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('session_id');

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['line_items']
        });

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Attempt to parse metadata block to get images
        let cartMetadata: any[] = [];
        try {
            if (session.metadata?.cart_items) {
                cartMetadata = JSON.parse(session.metadata.cart_items);
            }
        } catch (e) {
            console.error('Failed to parse cart metadata for receipt images', e);
        }

        // Map images back to line items (Stripe strips them out of session.line_items)
        const lineItemsWithImages = session.line_items?.data.map((item: any, index: number) => {
            const metadataImage = cartMetadata[index]?.i;
            return {
                ...item,
                custom_image: metadataImage || null
            };
        });

        return NextResponse.json({
            status: session.payment_status,
            customer_email: session.customer_details?.email,
            customer_name: session.customer_details?.name,
            amount_total: session.amount_total,
            shipping_details: (session as any).shipping_details,
            line_items: lineItemsWithImages
        });

    } catch (err: any) {
        console.error('Stripe Session Retrieval Error:', err);
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: err.statusCode || 500 }
        );
    }
}
