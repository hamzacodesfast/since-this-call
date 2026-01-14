
async function debug() {
    console.log("--- Debugging DexScreener Search for HYPE ---");
    const q = 'HYPE';
    const url = `https://api.dexscreener.com/latest/dex/search/?q=${q}`;

    try {
        const res = await fetch(url);
        const json = await res.json();

        if (json.pairs && json.pairs.length > 0) {
            console.log(`Found ${json.pairs.length} pairs.`);
            // Filter for exact symbol match and high liquidity
            const match = json.pairs.find((p: any) => p.baseToken.symbol.toUpperCase() === 'HYPE');
            if (match) {
                console.log("Top Match:");
                console.log(`Symbol: ${match.baseToken.symbol}`);
                console.log(`Price: $${match.priceUsd}`);
                console.log(`Liquidity: $${match.liquidity?.usd}`);
                console.log(`Chain: ${match.chainId}`);
                console.log(`Pair Address: ${match.pairAddress}`);
            }

            // Sort by liquidity
            const sorted = json.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
            console.log("Top Liquid Pair:");
            console.log(`Symbol: ${sorted[0].baseToken.symbol}`);
            console.log(`Price: $${sorted[0].priceUsd}`);
            console.log(`Chain: ${sorted[0].chainId}`);
        } else {
            console.log("No pairs found.");
        }
    } catch (e) {
        console.error("Search failed", e);
    }
}

debug();
