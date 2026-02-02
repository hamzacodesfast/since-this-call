
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
    { id: '1864501831507890634', args: ['--action=BUY'] }, // cobie (BTC implied)
    { id: '1944638949944607020', args: ['--action=BUY'] }, // cobie (BTC implied)
    { id: '2013960444126662984', args: ['--action=SELL'] }, // CryptoKid (Bearish)
    { id: '2017522276271374550', args: ['--action=SELL'] }, // DegenerateNews (Bearish BTC)
    { id: '2013930674722361407', args: ['--symbol=HYPE', '--action=SELL'] }, // DegenerateNews (HYPE Drop)
    { id: '2015062028889796928', args: ['--symbol=TSLA', '--action=BUY'] }, // alphacharts365
    { id: '2017311543805788593', args: ['--symbol=USELESS', '--action=BUY'] }, // theunipcs (Bullish USELESS)
    { id: '2014069322553974892', args: ['--action=SELL'] }, // altbullx (Bearish BTC)
    { id: '2016895412259434518', args: ['--symbol=DOG', '--action=BUY'] }, // Jova_Beta (Bullish DOG)
    { id: '2015457371426886125', args: ['--symbol=MSTR', '--action=SELL'] }, // comic (Bearish MSTR)
    { id: '2017227517275549940', args: ['--symbol=MSTR', '--action=SELL'] }, // OccamiCrypto (Bearish MSTR)
    { id: '2017001994125504991', args: ['--symbol=BMNR', '--action=SELL'] } // ZeeContrarian1 (Bearish BMNR)
];

async function run() {
    console.log(`💪 Correcting ${CORRECTIONS.length} tweets (Batch 4)...`);

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
    console.log('\n✅ Batch 4 Correction Complete.');
}

run();
