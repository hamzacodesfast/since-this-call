
async function debug() {
    const q = '67';
    console.log(`Searching DexScreener for: ${q}`);
    const url = `https://api.dexscreener.com/latest/dex/search/?q=${q}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.pairs && json.pairs.length > 0) {
        console.log(`Found ${json.pairs.length} pairs.`);
        // Sort by liquidity
        const sorted = json.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
        const top = sorted[0];
        console.log("Top Liquid Pair:");
        console.log(`Symbol: ${top.baseToken.symbol}`);
        console.log(`Name: ${top.baseToken.name}`);
        console.log(`Address: ${top.baseToken.address}`);
        console.log(`Price: ${top.priceUsd}`);
        console.log(`Chain: ${top.chainId}`);
        console.log(`Liquidity: ${top.liquidity?.usd}`);
    } else {
        console.log("No pairs found.");
    }
}
debug();
