
async function debug() {
    console.log("Testing GT SOL Minute Limit");
    const network = 'solana';
    // SOL main pool? SOL is native coin. Wrapped SOL?
    // Let's use Raydium/SOL pool.
    // Address for SOL-USDC pool?
    // Let's find pool via search/token.
    const token = 'So11111111111111111111111111111111111111112'; // Generic SOL?
    // Or just look up 'SOL' pools.

    const tokenUrl = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${token}/pools`;
    const res = await fetch(tokenUrl);
    const json = await res.json();

    if (json.data && json.data.length > 0) {
        const pool = json.data[0].attributes.address;
        console.log(`Using Pool: ${pool}`);
        const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${pool}/ohlcv/minute?limit=100`;
        const cRes = await fetch(url);
        const cJson = await cRes.json();
        if (cJson.data) {
            console.log(`Fetched ${cJson.data.attributes.ohlcv_list.length} candles.`);
        }
    } else {
        console.log("No pool found for SOL");
    }
}
debug();
