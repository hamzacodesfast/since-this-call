
async function debug() {
    console.log("--- Testing GeckoTerminal OHLCV ---");
    // Token '67' on Solana
    // Pool Address? GeckoTerminal needs POOL address, not Token Address for OHLCV often.
    // Or Token Address?
    // Docs: /networks/{network}/tokens/{token_address} -> Get Top Pools.
    // Then /networks/{network}/pools/{pool_address}/ohlcv/minute

    // Step 1: Get Pool for Token
    const network = 'solana';
    const token = 'BbT6YKRoiicuYyVYLT8HqJFuttGMTVwmkohdPDmDMK8j';

    console.log(`1. Finding Pool for Token: ${token} on ${network}`);
    const tokenUrl = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${token}/pools`;

    try {
        const res = await fetch(tokenUrl);
        const json = await res.json();

        if (json.data && json.data.length > 0) {
            const pool = json.data[0];
            const poolAddress = pool.attributes.address;
            console.log(`Found Pool: ${poolAddress} (Price: ${pool.attributes.base_token_price_usd})`);

            // Step 2: Get Minute Candles
            console.log("2. Fetching OHLCV (minute)...");
            // timeframe: minute? Or day? 
            // valid: day, hour, minute.
            // aggregate: 1, 5, 15.
            const candleUrl = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/ohlcv/minute?aggregate=1&limit=100`;
            const candleRes = await fetch(candleUrl);
            const candleJson = await candleRes.json();

            // check structure
            if (candleJson.data && candleJson.data.attributes && candleJson.data.attributes.ohlcv_list) {
                const candles = candleJson.data.attributes.ohlcv_list;
                console.log(`Fetched ${candles.length} candles.`);
                console.log("Sample candle:", candles[0]); // [timestamp, open, high, low, close, vol]
            } else {
                console.log("No candles found", JSON.stringify(candleJson, null, 2));
            }

        } else {
            console.log("No pools found for token.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
debug();
