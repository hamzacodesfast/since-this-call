
import { spawn } from 'child_process';
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const redis = new Redis({
    url: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
    token: process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const CORRECTIONS = [
    { id: '1993573426209210603', args: ['--symbol=SOL', '--action=BUY'] }, // LaMachina777
    { id: '1991919787090563512', args: ['--symbol=BCH', '--action=BUY'] }, // LaMachina777
    { id: '2015521196868026775', args: ['--symbol=AAPL', '--action=SELL'] }, // MMatters22596 (Regret selling)
    { id: '2013569295507239100', args: ['--symbol=DUOL', '--action=BUY'] }, // alc2022
    { id: '2017573315171287397', args: ['--action=SELL'] }, // polaris_xbt (Bearish BTC)
    { id: '2017017770534486518', args: ['--action=SELL'] }, // DarioCpx (Bearish)
    { id: '2016897478197448875', args: ['--action=SELL'] }, // ByzGeneral (Bearish)
    { id: '2017185931019862255', args: ['--symbol=MEGA', '--action=BUY'] }, // devchart (MegaETH)
    { id: '2013937479603126600', args: ['--action=BUY'] }, // devchart (Bullish BTC implied)
    { id: '2016534781245469036', args: ['--symbol=PENGUIN', '--action=BUY'] }, // JamesWynnReal
    { id: '2013824696845062492', args: ['--action=SELL'] }, // BrutalBtc (Bearish BTC)
    { id: '2013629563679424752', args: ['--action=SELL'] }, // ColinTCrypto (Bearish BTC)
    { id: '2017297618322219364', args: ['--symbol=SLV', '--action=SELL'] }, // ChartingGuy (Bearish Silver)
    { id: '2017261034579403196', args: ['--symbol=SLV', '--action=BUY'] }, // ChartingGuy (Plz go to 50 - Buy/Long)
    { id: '2016984475121443158', args: ['--symbol=COIN', '--action=SELL'] } // ChartingGuy (Bearish COIN)
];

async function run() {
    console.log(`💪 Correcting ${CORRECTIONS.length} tweets (Batch 5)...`);

    for (const item of CORRECTIONS) {
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
    console.log('\n✅ Batch 5 Correction Complete.');
}

run();
