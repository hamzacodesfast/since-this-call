
import { spawn } from 'child_process';
import path from 'path';

const REANALYSIS_LIST = [
    { id: '2015074967998562320', args: [] }, // RyansMethod (BTC)
    { id: '2016903318530859050', args: [] }, // swisstrader09 (BTC)
    { id: '2013786944061555157', args: [] }, // DonAlt (SOL)
    { id: '2013916831178789091', args: [] }, // cryptochimpanz (BTC)
    { id: '2012578948857708727', args: ['--symbol=CRV'] }, // pedrosilva
    { id: '2009180594866135519', args: [] }, // gh0stee (ZEC)
    { id: '2017081433039524010', args: ['--symbol=DOG'] }, // Relentless_btc
    { id: '2013654293837160683', args: [] }, // Taran_ss (BTC/INTC - logic should pick or fallback)
    { id: '2017318788874514853', args: ['--symbol=HYPE'] }, // Wild_Randomness
    { id: '2005623836746953045', args: ['--symbol=SLV'] }, // TheRealNomics (Explicit SLV)
    { id: '2012865058976469498', args: ['--symbol=BTC'] }, // cryptojack4u (BTC.D -> BTC proxy)
    { id: '2015225234350280742', args: [] }, // cburniske (BTC)
    { id: '2017020683835121734', args: ['--symbol=TSLA'] }, // GerberKawasaki
    { id: '2016206846051188840', args: ['--symbol=VELO'] }, // DeepInference
    { id: '2016205378904641897', args: ['--symbol=DX-Y.NYB'] }, // BobLoukas (DXY)
    { id: '2015109181540294910', args: ['--symbol=JD'] }, // StockChaser_
    { id: '2017246551454757147', args: [] }, // stoolpresidente (BTC/Crypto)
    { id: '2014934078697701781', args: [] }, // Tradermayne
    { id: '2013346180252529067', args: ['--symbol=USDT-USD'] } // MaxBecauseBTC (USDT.D -> USDT proxy? might fail)
];

async function runBatch() {
    console.log(`🔄 Starting batch reanalysis for ${REANALYSIS_LIST.length} tweets...`);

    for (const item of REANALYSIS_LIST) {
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
    console.log('\n✅ Batch reanalysis complete.');
}

runBatch();
