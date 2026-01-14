
async function debug() {
    const url = 'https://api.geckoterminal.com/api/v2/networks?page=1';
    const res = await fetch(url);
    const json = await res.json();
    if (json.data) {
        console.log("Networks (first page):");
        json.data.forEach((n: any) => console.log(`- ${n.id} (${n.attributes.name})`));

        // Check specifics
        const slugs = json.data.map((n: any) => n.id);
        console.log("Has solana?", slugs.includes('solana'));
        console.log("Has hyperliquid?", slugs.includes('hyperliquid'));
        console.log("Has base?", slugs.includes('base'));
    }
}
debug();
