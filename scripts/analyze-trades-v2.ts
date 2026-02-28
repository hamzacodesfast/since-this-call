import * as fs from 'fs';

// Stream-friendly: read the file once, extract only what we need
const data = JSON.parse(fs.readFileSync('backups/local_database_backup.json', 'utf8'));

const keyUsers = ['peterschiff', 'adeptmarket', 'mizerxbt', 'hajiyev_rashad', 'rektcapital', 'peterlbrandt', 'tradernoctis', 'barchart', 'cryptocurb', 'cryptosr_us', 'globalflows', 'bigcheds'];

for (const u of keyUsers) {
    const p = data.userProfiles[u];
    if (!p) { console.log(`@${u}: NOT FOUND`); continue; }
    const histRaw = data.userHistories[u] || [];
    // Only parse what we need
    const last3 = histRaw.slice(0, 3).map((h: any) => typeof h === 'string' ? JSON.parse(h) : h);
    last3.sort((a: any, b: any) => b.timestamp - a.timestamp);

    console.log(`\n@${p.username}: WR=${p.winRate}% (${p.totalAnalyses} calls, ${p.wins}W/${p.losses}L)`);
    for (const c of last3) {
        const d = new Date(c.timestamp).toISOString().split('T')[0];
        console.log(`  ${d}: ${c.action} ${c.ticker} @ $${c.entryPrice?.toFixed(2)} -> $${c.currentPrice?.toFixed(2)} | ${c.isWin ? 'WIN' : 'LOSS'}`);
        console.log(`    "${c.text?.substring(0, 130)}"`);
    }
}

// Recent analyses
console.log("\n=== RECENT ANALYSES ===");
for (const raw of data.recentAnalyses) {
    const c = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const uName = Object.keys(data.userProfiles).find(k => k.toLowerCase() === c.username?.toLowerCase());
    const p = uName ? data.userProfiles[uName] : null;
    const d = new Date(c.timestamp).toISOString().split('T')[0];
    console.log(`${d} | @${c.username} (WR=${p ? p.winRate : '?'}%, ${p ? p.totalAnalyses : '?'} calls) | ${c.action} ${c.ticker} @ $${c.entryPrice?.toFixed(2)}`);
    console.log(`  "${c.text?.substring(0, 130)}"`);
}

console.log("\nDone.");
process.exit(0);
