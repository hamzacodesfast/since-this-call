
async function debug() {
    const network = 'solana';
    const pool = 'Gw6eR2BaLNfXtdzYNoNyt8LxXXEJcGsVbAovc3Z32XsR';
    const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${pool}/ohlcv/minute?aggregate=1&limit=1000`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.data && json.data.attributes && json.data.attributes.ohlcv_list) {
        console.log(`Fetched ${json.data.attributes.ohlcv_list.length} candles.`);
    }
}
debug();
