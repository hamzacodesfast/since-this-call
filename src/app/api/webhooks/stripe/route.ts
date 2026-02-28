import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-01-27.acacia' as any,
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export async function POST(req: Request) {
    const payload = await req.text();
    const signature = req.headers.get('stripe-signature');

    let event: Stripe.Event;

    try {
        if (!signature || !endpointSecret) {
            throw new Error("Missing stripe-signature header or webhook secret");
        }
        event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    } catch (err: any) {
        console.error(`⚠️  Webhook signature verification failed.`, err.message);
        return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`💰 Payment was successful for session: ${session.id}!`);

            // Mock Printify Fulfillment Logic
            try {
                await handlePrintifyFulfillment(session);
            } catch (e: any) {
                console.error('Failed to trigger Printify fulfillment:', e.message);
                // You might want to return a 500 here so Stripe retries the webhook, or alert admin
            }
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
}

// Live function to call the Printify API
async function handlePrintifyFulfillment(session: Stripe.Checkout.Session) {
    const shippingDetails = (session as any).shipping_details;
    const customerDetails = session.customer_details;

    // Stripe sometimes stashes the address in customerDetails if billing and shipping are same or Link is used
    const mergedAddress = shippingDetails?.address || customerDetails?.address;
    const customerName = shippingDetails?.name || customerDetails?.name || 'Customer';
    const customerEmail = customerDetails?.email;

    const metadata = session.metadata || {};
    let cartItems = [];
    try {
        cartItems = JSON.parse(metadata.cart_items || '[]');
    } catch (e) {
        throw new Error('Could not parse cart items from session metadata');
    }

    if (!cartItems.length) {
        throw new Error('No items found in session metadata');
    }

    if (!mergedAddress) {
        console.error("Session Details Context:", JSON.stringify({ shippingDetails, customerDetails }));
        throw new Error('No shipping details found in session');
    }

    const { line1, line2, city, state, postal_code, country } = mergedAddress;

    const printifyShopId = process.env.PRINTIFY_SHOP_ID;
    const printifyApiKey = process.env.PRINTIFY_API_KEY;

    if (!printifyShopId || !printifyApiKey || printifyApiKey === 'mock') {
        console.warn('⚠️ Printify variables missing or set to mock. Skipping actual API call.');
        return;
    }

    const orderPayload = {
        external_id: session.id, // prevents duplicate orders
        label: `Order ${session.id.slice(-8)}`,
        line_items: cartItems.map((item: any) => ({
            product_id: item.p,
            variant_id: parseInt(item.v, 10),
            quantity: item.q
        })),
        shipping_method: 1, // 1 = standard
        send_shipping_notification: true,
        address_to: {
            first_name: customerName.split(' ')[0] || 'Unknown',
            last_name: customerName.split(' ').slice(1).join(' ') || 'Customer',
            email: customerEmail || 'no-reply@sincethiscall.com',
            region: state,
            address1: line1,
            address2: line2 || '',
            city: city,
            zip: postal_code,
            country: country
        }
    };

    console.log(`[PRINTIFY] Creating order for Stripe Session: ${session.id} with ${cartItems.length} items.`);

    const response = await fetch(`https://api.printify.com/v1/shops/${printifyShopId}/orders.json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${printifyApiKey}`
        },
        body: JSON.stringify(orderPayload)
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`[PRINTIFY ERROR] Failed to create order: ${response.status} ${response.statusText}`);
        console.error(errText);
        throw new Error(`Printify API Error: ${errText}`);
    }

    const orderData = await response.json();
    console.log(`✅ [PRINTIFY SUCCESS] Order created successfully! ID: ${orderData.id}`);

    // --- SMTP RECEIPT DISPATCH ---
    await sendReceiptEmail(customerEmail || '', customerName || '', session.id, cartItems, session.amount_total);
}

async function sendReceiptEmail(
    to: string,
    customerName: string,
    sessionId: string,
    items: any[],
    totalCents: number | null
) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        console.warn('⚠️ SMTP variables missing. Skipping email receipt.');
        return;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT, 10),
            secure: parseInt(SMTP_PORT, 10) === 465, // true for 465, false for other ports
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });

        const totalFormatted = totalCents ? `$${(totalCents / 100).toFixed(2)}` : 'TBD';
        const orderId = sessionId.slice(-8).toUpperCase();

        const html = `
            <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
                <h2 style="color: #000;">Thank you for your order, ${customerName.split(' ')[0]}!</h2>
                <p>We've received your order <strong>#${orderId}</strong> and it is now being processed.</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background-color: #f8f9fa; text-align: left;">
                            <th style="padding: 12px; border-bottom: 2px solid #ddd; width: 60px;">Item</th>
                            <th style="padding: 12px; border-bottom: 2px solid #ddd;">Details</th>
                            <th style="padding: 12px; border-bottom: 2px solid #ddd; text-align: center;">Qty</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(i => `
                            <tr>
                                <td style="padding: 12px; border-bottom: 1px solid #ddd; vertical-align: middle;">
                                    ${i.i ? `<img src="${i.i}" alt="Product Image" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #eee;" />` : '<div style="width: 50px; height: 50px; background: #eee; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999;">STC</div>'}
                                </td>
                                <td style="padding: 12px; border-bottom: 1px solid #ddd; vertical-align: middle;">
                                    <strong>Product:</strong> ${i.p}<br/>
                                    <span style="font-size: 12px; color: #666;">Variant: ${i.v}</span>
                                </td>
                                <td style="padding: 12px; border-bottom: 1px solid #ddd; vertical-align: middle; text-align: center;">${i.q}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <h3 style="text-align: right; margin-top: 20px;">Total: ${totalFormatted}</h3>
                <p style="margin-top: 30px; font-size: 14px; color: #666;">
                    If you have any questions, reply to this email or contact info@sincethiscall.com
                </p>
                <p style="font-size: 12px; color: #999; text-align: center; margin-top: 40px;">
                    Since This Call | The AI Powered Social Prediction Tracker
                </p>
            </div>
        `;

        await transporter.sendMail({
            from: `"Since This Call Merch" <${SMTP_USER}>`,
            to,
            subject: `Order Confirmation #${orderId}`,
            html,
        });

        console.log(`[SMTP] Receipt sent successfully to ${to}`);
    } catch (e: any) {
        console.error('[SMTP ERROR] Failed to send receipt:', e.message);
    }
}
