import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-01-27.acacia' as any,
});

async function check() {
    const sessions = await stripe.checkout.sessions.list({ limit: 1 });
    const s = sessions.data[0];
    console.log("Customer Details:", JSON.stringify(s.customer_details, null, 2));
    console.log("Shipping Details:", JSON.stringify((s as any).shipping_details, null, 2));
}

check();
