import * as fs from 'fs';
import * as path from 'path';

function analyzeTrades() {
    const backupDir = path.join(process.cwd(), 'backups');
    const filepath = path.join(backupDir, 'local_database_backup.json');
    if (!fs.existsSync(filepath)) {
        console.error("Backup file not found!");
        return;
    }

    const rawData = fs.readFileSync(filepath, 'utf8');
    const data = JSON.parse(rawData);

    const userProfiles = data.userProfiles;
    const userHistories = data.userHistories;

    // Parse user properties as numbers
    const parsedUsers = Object.entries(userProfiles).map(([username, profile]: [string, any]) => {
        return {
            username,
            totalAnalyses: parseInt(profile.totalAnalyses || "0"),
            winRate: parseFloat(profile.winRate || "0"),
            wins: parseInt(profile.wins || "0"),
            losses: parseInt(profile.losses || "0"),
            neutral: parseInt(profile.neutral || "0"),
        }
    });

    const inverseFarmers = parsedUsers.filter(u => u.totalAnalyses >= 20 && u.winRate <= 35);
    // Relaxed Silent Sniper: > 15 calls, > 63% win rate
    const silentSnipers = parsedUsers.filter(u => u.totalAnalyses >= 15 && u.winRate >= 60);

    console.log("\n--- PLAYBOOK 1: INVERSE ENGAGEMENT FARMERS ---");
    let playbook1Found = [];
    for (const farmer of inverseFarmers) {
        const historyRaw = userHistories[farmer.username] || [];
        const history = historyRaw.map(h => typeof h === 'string' ? JSON.parse(h) : h).sort((a, b) => b.timestamp - a.timestamp);
        if (history.length > 0) {
            const recentCall = history[0];
            if (recentCall.confidence_score >= 0.7) {
                playbook1Found.push({
                    farmer, call: recentCall
                });
            }
        }
    }
    // Take top 2 most extreme farmers (lowest win rate)
    playbook1Found.sort((a, b) => a.farmer.winRate - b.farmer.winRate);
    for (let i = 0; i < Math.min(2, playbook1Found.length); i++) {
        const { farmer, call } = playbook1Found[i];
        console.log(`[FADE] ${call.ticker} - Opposite of @${farmer.username}`);
        console.log(`  Reason: Farmer Win Rate ${farmer.winRate.toFixed(1)}% over ${farmer.totalAnalyses} calls.`);
        console.log(`  Their call: ${call.action} ${call.ticker} (${call.confidence_score * 100}% confidence).`);
        console.log(`  Recommendation: Trade ${call.action === 'BUY' ? 'SHORT' : 'LONG'} ${call.ticker}. Risk 2-3% max.`);
        console.log(`  Source: ${call.tweetUrl}\n`);
    }

    console.log("--- PLAYBOOK 2: SILENT SNIPERS ---");
    let playbook2Found = [];
    for (const sniper of silentSnipers) {
        const historyRaw = userHistories[sniper.username] || [];
        const history = historyRaw.map(h => typeof h === 'string' ? JSON.parse(h) : h).sort((a, b) => b.timestamp - a.timestamp);
        if (history.length > 1) {
            const recentCall = history[0];
            const prevCall = history[1];
            const gapDays = (recentCall.timestamp - prevCall.timestamp) / 86400000;
            if (gapDays > 4) { // Look for 4+ days of silence
                playbook2Found.push({
                    sniper, call: recentCall, gapDays: Math.round(gapDays)
                });
            }
        }
    }
    playbook2Found.sort((a, b) => b.sniper.winRate - a.sniper.winRate);
    for (let i = 0; i < Math.min(1, playbook2Found.length); i++) {
        const { sniper, call, gapDays } = playbook2Found[i];
        console.log(`[COPY] ${call.ticker} - Following @${sniper.username}`);
        console.log(`  Reason: Sniper Win Rate ${sniper.winRate.toFixed(1)}% over ${sniper.totalAnalyses} calls. Broke ${gapDays} days of silence.`);
        console.log(`  Their call: ${call.action} ${call.ticker}.`);
        console.log(`  Recommendation: Trade ${call.action} ${call.ticker}.`);
        console.log(`  Source: ${call.tweetUrl}\n`);
    }

    console.log("--- PLAYBOOK 3 & 4: SMART MONEY DIVERGENCE / SECTOR ROTATION ---");
    const allRecentAnalyses = data.recentAnalyses.map(h => typeof h === 'string' ? JSON.parse(h) : h);

    // Group recent calls by ticker
    const tickerCalls = {};
    for (const call of allRecentAnalyses) {
        if (!tickerCalls[call.ticker]) tickerCalls[call.ticker] = [];
        tickerCalls[call.ticker].push(call);
    }

    let tickerSentiments = [];
    for (const [ticker, callsObj] of Object.entries(tickerCalls)) {
        const calls = callsObj as any[];
        if (calls.length >= 2) {
            let smartMoneyBuying = 0;
            let smartMoneySelling = 0;
            let farmerBuying = 0;
            let farmerSelling = 0;
            let totalVolume = calls.length;

            for (const call of calls) {
                // Must get user from profile since call.username isn't always reliable or lowercased
                let uName = "";
                if (call.username) {
                    // find match in userProfiles ignoring case
                    const match = Object.keys(data.userProfiles).find(k => k.toLowerCase() === call.username.toLowerCase());
                    if (match) uName = match;
                }
                const profile = data.userProfiles[uName];
                if (profile) {
                    const wr = parseFloat(profile.winRate);
                    const ta = parseInt(profile.totalAnalyses);
                    if (wr >= 60 && ta >= 5) {
                        if (call.action === 'BUY') smartMoneyBuying++;
                        if (call.action === 'SELL') smartMoneySelling++;
                    }
                    if (wr <= 35 && ta >= 5) {
                        if (call.action === 'BUY') farmerBuying++;
                        if (call.action === 'SELL') farmerSelling++;
                    }
                }
            }

            tickerSentiments.push({
                ticker, totalVolume,
                smartMoneyBuying, smartMoneySelling,
                farmerBuying, farmerSelling,
                calls
            });
        }
    }

    // Sort by most interesting divergences
    tickerSentiments.sort((a, b) => b.totalVolume - a.totalVolume);

    let printedDivergences = 0;
    for (const ts of tickerSentiments) {
        if (ts.smartMoneyBuying > 0 && ts.farmerSelling >= 0) {
            console.log(`[DIVERGENCE LONG] ${ts.ticker}`);
            console.log(`  Reason: Smart Money is BUYING while market is panicked/farmers are selling.`);
            console.log(`  Data: ${ts.smartMoneyBuying} high-WR accounts went LONG. Volume SPIKE (${ts.totalVolume} recent calls).`);
            console.log(`  Recommendation: Swing LONG ${ts.ticker}.`);
            console.log(`  Recent example: ${ts.calls.find(c => c.action === 'BUY')?.tweetUrl}\n`);
            printedDivergences++;
        }
        else if (ts.smartMoneySelling > 0 && ts.farmerBuying >= 0) {
            console.log(`[DIVERGENCE SHORT] ${ts.ticker}`);
            console.log(`  Reason: Smart Money is SELLING while farmers are buying the top.`);
            console.log(`  Data: ${ts.smartMoneySelling} high-WR accounts went SHORT. Volume SPIKE (${ts.totalVolume} recent calls).`);
            console.log(`  Recommendation: Swing SHORT ${ts.ticker}.`);
            console.log(`  Recent example: ${ts.calls.find(c => c.action === 'SELL')?.tweetUrl}\n`);
            printedDivergences++;
        }
        if (printedDivergences >= 2) break;
    }
}

analyzeTrades();
