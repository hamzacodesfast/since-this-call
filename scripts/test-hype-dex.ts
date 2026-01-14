
import { getPriceByContractAddress } from '../src/lib/market-data';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    const CA = '0x13ba5fea7078ab3798fbce53b4d0721c'; // From previous search
    console.log(`Fetching HYPE from DexScreener (CA: ${CA})...`);

    const data = await getPriceByContractAddress(CA);
    if (data) {
        console.log("Success!");
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log("Failed to fetch HYPE from DexScreener.");
    }
}
debug();
