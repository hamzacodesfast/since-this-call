import { getPrice } from '../src/lib/market-data';

async function check() {
    const p = await getPrice('NVDA', 'CRYPTO');
    console.log("Price of CRYPTO:NVDA is:", p);
}
check();
