
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
    { id: '2017353343681663142', args: ['--symbol=BMNR', '--action=BUY'] }, // fundstrat
    { id: '2016990759166034052', args: ['--symbol=SNDK', '--action=BUY'] }, // RJCcapital
    { id: '1995333381115298072', args: ['--action=SELL'] }, // frankdegods (ETH)
    { id: '2013546160611361009', args: ['--action=BUY'] }, // i_bot404 (BTC)
    { id: '2015093828785770632', args: ['--symbol=MSFT', '--action=SELL'] }, // CyclesFan
    { id: '2016150414631321705', args: ['--action=SELL'] }, // Axel_bitblaze69 (BTC)
    { id: '2011251414891446574', args: ['--symbol=ASTER', '--action=BUY'] }, // Aster_DEX
    { id: '2013612674953691209', args: ['--symbol=ASTER', '--action=BUY'] }, // Aster_DEX
    { id: '2017393418255909013', args: ['--action=SELL'] }, // greenytrades (BTC)
    { id: '2016829787290161653', args: ['--symbol=SLV', '--action=SELL'] } // saxena_puru
];

const REMOVALS = [
    { id: '2016946085391192481', username: 'miragemunny' },
    { id: '2017092726043660487', username: 'miragemunny' }
];

async function run() {
    // 1. Run Corrections
    console.log(`💪 Correcting ${CORRECTIONS.length} tweets...`);
    for (const item of CORRECTIONS) {
        await new Promise<void>((resolve) => {
            console.log(`\n-----------------------------------`);
            console.log(`Running for ${item.id}...`);
            const p = spawn('npx', ['tsx', 'scripts/reanalyze.ts', item.id, ...item.args], {
                cwd: process.cwd(),
                stdio: 'inherit',
                shell: true
            });
            p.on('close', resolve);
        });
    }

    // 2. Run Removals
    console.log(`\n🗑 Removing ${REMOVALS.length} untrackable tweets...`);
    for (const { id, username } of REMOVALS) {
        console.log(`Removing ${id} (@${username})...`);
        await redis.del(`analysis:${id}`);
        const historyKey = `user:history:${username.toLowerCase()}`;
        const historyData = await redis.lrange(historyKey, 0, -1);
        const history = historyData.map((item: any) => typeof item === 'string' ? JSON.parse(item) : item);
        const filteredHistory = history.filter((h: any) => h.id !== id);
        if (filteredHistory.length < history.length) {
            await redis.del(historyKey);
            if (filteredHistory.length > 0) {
                const p = redis.pipeline();
                filteredHistory.reverse().forEach((item: any) => p.lpush(historyKey, JSON.stringify(item)));
                await p.exec();
            }
        }
    }

    console.log('\n✅ Batch 3 Complete.');
}

run();
