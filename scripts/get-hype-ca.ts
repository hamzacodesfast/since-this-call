
async function debug() {
    const q = 'HYPE';
    const url = `https://api.dexscreener.com/latest/dex/search/?q=${q}`;
    const res = await fetch(url);
    const json = await res.json();
    const match = json.pairs.find((p: any) => p.baseToken.symbol.toUpperCase() === 'HYPE' && p.chainId === 'hyperliquid');
    if (match) {
        console.log("HYPE (Hyperliquid) Found:");
        console.log(`Address: ${match.baseToken.address}`);
        console.log(`Price: ${match.priceUsd}`);
    } else {
        console.log("Not found on Hyperliquid chain");
        // Fallback check
        const top = json.pairs[0];
        console.log(`Top Pair: ${top.baseToken.symbol} on ${top.chainId} (${top.baseToken.address})`);
    }
}
debug();
