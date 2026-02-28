import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const shopId = process.env.PRINTIFY_SHOP_ID;
    const apiKey = process.env.PRINTIFY_API_KEY;

    if (!shopId || !apiKey) {
        return NextResponse.json({ error: 'Printify credentials missing' }, { status: 500 });
    }

    try {
        const res = await fetch(`https://api.printify.com/v1/shops/${shopId}/products/${id}.json`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Printify API returned ${res.status}: ${text}`);
        }

        const product = await res.json();
        return NextResponse.json({ product });
    } catch (err: any) {
        console.error('API /printify/product Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
