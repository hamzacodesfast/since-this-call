import { calculatePerformance } from './src/lib/market-data';

console.log("Testing calculatePerformance:");
const call = 100;
const curr = 90; // Price drop
console.log(`BULLISH (100 -> 90): ${calculatePerformance(call, curr, 'BULLISH')}% (Expected: -10%)`);
console.log(`BEARISH (100 -> 90): ${calculatePerformance(call, curr, 'BEARISH')}% (Expected: +10%)`);

const call2 = 100;
const curr2 = 110; // Price rise
console.log(`BULLISH (100 -> 110): ${calculatePerformance(call2, curr2, 'BULLISH')}% (Expected: +10%)`);
console.log(`BEARISH (100 -> 110): ${calculatePerformance(call2, curr2, 'BEARISH')}% (Expected: -10%)`);
