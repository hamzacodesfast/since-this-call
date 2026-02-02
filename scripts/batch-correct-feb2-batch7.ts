
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
    { id: '2017348329286271206', args: ['--symbol=OPEN', '--action=SELL'] }, // gnoble79 (Bearish OPEN)
    { id: '2017349388696199274', args: ['--symbol=OPEN', '--action=SELL'] }, // gnoble79 (Bearish OPEN)
    { id: '2016289473424678925', args: ['--symbol=IGV', '--action=SELL'] }  // HostileCharts (Bearish IGV)
];

async function run() {
    console.log(`💪 Correcting ${CORRECTIONS.length} tweets (Batch 7)...`);

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
    console.log('\n✅ Batch 7 Correction Complete.');
}

run();
