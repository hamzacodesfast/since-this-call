
import { getPrice } from '../src/lib/market-data';

async function main() {
    console.log('Testing Yahoo Finance for AAPL (STOCK)...');
    try {
        const price = await getPrice('AAPL', 'STOCK');
        console.log('Current AAPL Price:', price);

        const oldDate = new Date('2024-01-01');
        const oldPrice = await getPrice('AAPL', 'STOCK', oldDate);
        console.log('AAPL Price on 2024-01-01:', oldPrice);
    } catch (e) {
        console.error('Error:', e);
    }
}
main();
