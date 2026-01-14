
import { getPriceByContractAddress } from '../src/lib/market-data';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    const CA = '0x13ba5fea7078ab3798fbce53b4d0721c';
    console.log(`Checking DexScreener for CA: ${CA}`);

    // Manual Fetch to see raw response
    const url = `https://api.dexscreener.com/latest/dex/tokens/${CA}`;
    console.log(`URL: ${url}`);

    try {
        const res = await fetch(url);
        const json = await res.json();
        console.log("Raw Response Pairs Count:", json.pairs?.length);
        if (json.pairs?.length > 0) {
            console.log("Top Pair Symbol:", json.pairs[0].baseToken.symbol);
            console.log("Top Pair Chain:", json.pairs[0].chainId);
            console.log("Top Pair Price:", json.pairs[0].priceUsd);
        } else {
            console.log("Raw Response:", JSON.stringify(json, null, 2));
        }

        // Test function
        const data = await getPriceByContractAddress(CA);
        console.log("\nFunction Result:", data);

    } catch (e) {
        console.error("Manual Fetch Error:", e);
    }
}
debug();
