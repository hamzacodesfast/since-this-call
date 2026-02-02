
import { spawn } from 'child_process';

const FORCE_LIST = [
    { id: '2016903318530859050', args: ['--action=SELL'] }, // swisstrader09 (Bearish)
    { id: '2012578948857708727', args: ['--symbol=CRV', '--action=BUY'] }, // pedrosilva (Bullish CRV)
    { id: '2017081433039524010', args: ['--symbol=DOG', '--action=BUY'] }, // Relentless_btc (Bullish DOG)
    { id: '2017318788874514853', args: ['--symbol=HYPE', '--action=BUY'] }, // Wild_Randomness (Bullish HYPE)
    { id: '2013654293837160683', args: ['--action=BUY'] }, // Taran_ss (Bullish BTC)
    { id: '2014934078697701781', args: ['--action=BUY'] } // Tradermayne (Bullish)
];

async function runForceBatch() {
    console.log(`💪 Force-correcting ${FORCE_LIST.length} tweets...`);

    for (const item of FORCE_LIST) {
        await new Promise<void>((resolve) => {
            console.log(`\n-----------------------------------`);
            console.log(`Running for ${item.id} ${item.args.join(' ')}...`);

            const p = spawn('npx', ['tsx', 'scripts/reanalyze.ts', item.id, ...item.args], {
                cwd: process.cwd(),
                stdio: 'inherit',
                shell: true
            });

            p.on('close', (code) => {
                console.log(`Completed with code ${code}`);
                resolve();
            });
        });
    }
    console.log('\n✅ Force batch complete.');
}

runForceBatch();
