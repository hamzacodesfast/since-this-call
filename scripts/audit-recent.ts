
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
    const { getRecentAnalyses } = await import('../src/lib/analysis-store');
    const analyses = await getRecentAnalyses(10);
    console.log(JSON.stringify(analyses, null, 2));
}

run();
