
import { getPrice } from '../src/lib/market-data';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    console.log("--- Debugging HYPE Price ---");

    // Test Current Price (Daily)
    console.log("Fetching Current Price for HYPE (CRYPTO)...");
    const current = await getPrice("HYPE", "CRYPTO");
    console.log(`Current Price: ${current}`);

    // Test Historical (Date: Dec 20, 2025 - Tweet Date)
    const date = new Date("2026-01-12T12:00:00Z"); // Approx tweet time
    console.log(`Fetching Historical Price for HYPE on ${date.toISOString()}...`);
    const history = await getPrice("HYPE", "CRYPTO", date);
    console.log(`Historical Price: ${history}`);

    // Check specific URL manually if getPrice fails
    if (!current) {
        console.log("--- Manual Fetch Test ---");
        const url = "https://query2.finance.yahoo.com/v8/finance/chart/HYPE-USD?interval=1d&range=5d";
        const res = await fetch(url);
        console.log(`Manual Fetch verify: ${res.status} ${res.statusText}`);
        if (res.ok) {
            const json = await res.json();
            console.log("Result:", JSON.stringify(json.chart.result?.[0]?.meta?.regularMarketPrice, null, 2));
        } else {
            const txt = await res.text();
            console.log("Error Body:", txt);
        }
    }
}

debug();
