import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function rescueStuckProducts() {
    const shopId = process.env.PRINTIFY_SHOP_ID;
    const apiKey = process.env.PRINTIFY_API_KEY;

    if (!shopId || !apiKey) {
        throw new Error("Missing Printify API keys in .env.local");
    }

    console.log(`Fetching products for shop ${shopId}...`);
    const res = await fetch(`https://api.printify.com/v1/shops/${shopId}/products.json`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!res.ok) throw new Error("Failed to fetch products");

    const data = await res.json();
    const products = data.data || [];

    let count = 0;
    for (const product of products) {
        console.log(`\nAttempting to rescue: ${product.title} (${product.id})`);

        try {
            const rescueRes = await fetch(`https://api.printify.com/v1/shops/${shopId}/products/${product.id}/publishing_succeeded.json`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    external: {
                        id: product.id,
                        handle: `https://sincethiscall.com/merch/${product.id}`
                    }
                })
            });

            if (rescueRes.ok) {
                console.log(`✅ Success: Unlocked ${product.id}`);
                count++;
            } else {
                const err = await rescueRes.text();
                // This will fail normally if the product is NOT stuck in publishing, 
                // because you can only mark an active 'Publishing' request as succeeded.
                if (err.includes('Product must be in publishing state')) {
                    console.log(`⏭️  Skipped: Product is already fully published or drafted.`);
                } else {
                    console.log(`⚠️ Status: ${rescueRes.statusText} - Details: ${err}`);
                }
            }
        } catch (e: any) {
            console.log(`❌ Error: ${e.message}`);
        }
    }

    console.log(`\nFinished checking ${products.length} products. Successfully forced ${count} publish updates.`);
}

rescueStuckProducts();
