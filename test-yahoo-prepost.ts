async function testYahoo(symbol: string, dateStr: string) {
    const date = new Date(dateStr);
    const targetTime = Math.floor(date.getTime() / 1000);
    const YAHOO_BASE = 'https://query2.finance.yahoo.com/v8/finance/chart';

    // Test with and without includePrePost
    const urls = [
        `${YAHOO_BASE}/${symbol}?period1=${targetTime - 3600}&period2=${targetTime + 3600}&interval=1m&events=history`,
        `${YAHOO_BASE}/${symbol}?period1=${targetTime - 3600}&period2=${targetTime + 3600}&interval=1m&events=history&includePrePost=true`
    ];

    for (const url of urls) {
        console.log(`\nTesting URL: ${url}`);
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!res.ok) {
                console.log(`Failed: ${res.status}`);
                continue;
            }
            const json: any = await res.json();
            const result = json.chart.result[0];
            const times = result.timestamp;
            const quotes = result.indicators.quote[0].close;

            if (!times || times.length === 0) {
                console.log("No data returned.");
            } else {
                console.log(`Count: ${times.length}`);
                // Find closest
                let best = null, mindiff = Infinity;
                for (let i = 0; i < times.length; i++) {
                    const d = Math.abs(times[i] - targetTime);
                    if (d < mindiff && quotes[i] !== null) { mindiff = d; best = quotes[i]; }
                }
                console.log(`Closest price: ${best} (diff: ${mindiff}s)`);
            }
        } catch (e) {
            console.error(e);
        }
    }
}

testYahoo("AAPL", "2026-01-29T21:30:17.000Z");
