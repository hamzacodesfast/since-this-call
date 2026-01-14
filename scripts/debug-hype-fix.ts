
import { getPrice } from '../src/lib/market-data';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    console.log("--- Testing HYPE Fix ---");
    try {
        const price = await getPrice('HYPE', 'CRYPTO');
        console.log(`Current Price for HYPE: ${price}`);

        if (price) {
            console.log("SUCCESS");
        } else {
            console.log("FAILURE: Price is null");
        }

        // Test historical estimation
        const date = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
        const hist = await getPrice('HYPE', 'CRYPTO', date);
        console.log(`Historical Price (-2h): ${hist}`);
    } catch (e) {
        console.error("Error:", e);
    }
}
debug();
