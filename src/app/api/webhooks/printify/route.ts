import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Printify webhook payload for publish events:
        // { type: 'product:publish:started', resource: { type: 'product', id: 'string' } }
        const type = body?.type;
        const productId = body?.resource?.id || body?.data?.id || body?.id;

        if (type === 'product:publish:started' && productId) {
            const shopId = process.env.PRINTIFY_SHOP_ID;
            const apiKey = process.env.PRINTIFY_API_KEY;

            if (!shopId || !apiKey) {
                console.error('[Printify Webhook] Missing credentials');
                return NextResponse.json({ error: 'Missing Credentials' }, { status: 500 });
            }

            // The Handshake: Call publishing_succeeded.json to unlock the product
            const res = await fetch(`https://api.printify.com/v1/shops/${shopId}/products/${productId}/publishing_succeeded.json`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    external: {
                        id: productId, // We just reflect the Printify ID as our internal ID
                        handle: `https://sincethiscall.com/merch/${productId}` // This enables the "See in store" button in the Printify dashboard
                    }
                })
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error(`[Printify Webhook] Publishing Handshake failed for ${productId}:`, errText);
                return NextResponse.json({ error: 'Publish Handshake Failed' }, { status: 500 });
            }

            console.log(`[Printify Webhook] Successfully unlocked product ${productId} from Publishing state.`);
            return NextResponse.json({ success: true, status: 'published' });
        }

        // Acknowledge other webhook events quietly
        return NextResponse.json({ received: true });
    } catch (err: any) {
        console.error('[Printify Webhook] Error:', err.message);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
