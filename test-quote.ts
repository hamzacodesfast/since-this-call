
async function testQuote(symbol: string) {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const json = await res.json();
        const quote = json.quoteResponse.result[0];
        console.log(`${symbol}: ${quote.regularMarketPrice} (${quote.shortName})`);
    } catch (e) {
        console.log(`${symbol} failed: ${e}`);
    }
}

async function main() {
    await testQuote('SI=F');
    await testQuote('GC=F');
    await testQuote('SLV');
    await testQuote('GLD');
}
main();
