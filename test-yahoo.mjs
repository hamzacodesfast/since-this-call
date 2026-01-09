
import YahooFinance from 'yahoo-finance2';

async function test() {
    try {
        console.log('Attempting instantiation...');
        const yahooFinance = new YahooFinance();

        console.log('Testing Yahoo Finance execution...');
        const quote = await yahooFinance.quote('AAPL');
        console.log('Quote success:', quote.symbol, quote.regularMarketPrice);

        const hist = await yahooFinance.historical('AAPL', { period1: '2024-01-01', interval: '1d' });
        console.log('History success, rows:', hist.length);
    } catch (e) {
        console.error('Yahoo Test Failed:', e);
    }
}

test();
