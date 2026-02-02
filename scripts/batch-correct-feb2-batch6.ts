
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
    { id: '2016953670030463363', args: ['--symbol=NBIS', '--action=BUY'] }, // MB_Hogan (Bullish NBIS)
    { id: '2016255717012078702', args: ['--symbol=NBIS', '--action=BUY'] }, // MB_Hogan (Bullish NBIS)
    { id: '2017057873470304764', args: ['--symbol=TSLA', '--action=BUY'] }, // stevenmarkryan
    { id: '2017451523329167635', args: ['--symbol=TSLA', '--action=BUY'] }, // stevenmarkryan
    { id: '2017569904866545917', args: ['--symbol=PENGUIN', '--action=BUY'] }, // watchingmarkets
    { id: '2017314110560411826', args: ['--symbol=PENGUIN', '--action=BUY'] }, // watchingmarkets
    { id: '2017314815685898719', args: ['--symbol=WOJAK', '--action=BUY'] }, // watchingmarkets
    { id: '2017612712340296040', args: ['--symbol=MSTR', '--action=SELL'] }, // PeterSchiff
    { id: '2016563244119347321', args: ['--symbol=BTC', '--action=SELL'] }, // PeterSchiff
    { id: '2017129959345762414', args: ['--symbol=DOG', '--action=BUY'] }, // Cryptolution
    { id: '2017329591262842951', args: ['--symbol=DOG', '--action=BUY'] }, // Cryptolution
    { id: '2017290243880456398', args: ['--symbol=DOG', '--action=BUY'] }  // Cryptolution
];

async function run() {
    console.log(`💪 Correcting ${CORRECTIONS.length} tweets (Batch 6)...`);

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
    console.log('\n✅ Batch 6 Correction Complete.');
}

run();
