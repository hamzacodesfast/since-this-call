import { getPrice } from './src/lib/market-data';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function diagnose(symbol: string, dateStr: string) {
    const date = new Date(dateStr);
    console.log(`\nDiagnosing ${symbol} on ${dateStr}...`);
    try {
        const price = await getPrice(symbol, 'STOCK', date);
        console.log(`Result: ${price !== null ? '$' + price : 'NOT FOUND'}`);
    } catch (e: any) {
        console.error(`Error: ${e.message}`);
    }
}

async function main() {
    await diagnose('GME', '2026-01-26T04:25:21Z');
    await diagnose('BABA', '2026-01-26T01:14:43Z');
    await diagnose('GME', '2026-01-23T13:28:47Z');
    await diagnose('HIMS', '2026-01-19T02:00:00Z');
    await diagnose('LAC', '2026-01-23T00:00:01Z');
}

main();
