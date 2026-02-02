
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
    console.error('❌ No API Key found');
    process.exit(1);
}

async function testModel(modelName: string) {
    console.log(`\n🤖 Testing Model: ${modelName}...`);
    try {
        const start = Date.now();
        const { text } = await generateText({
            model: google(modelName),
            prompt: "Return the word 'Pong' and nothing else.",
        });
        const latency = Date.now() - start;
        console.log(`✅ Success (${latency}ms): ${text}`);
    } catch (error: any) {
        console.error(`❌ Failed: ${error.message}`);
    }
}

async function run() {
    console.log('🔑 API Key present: ', apiKey ? 'YES (' + apiKey.substring(0, 8) + '...)' : 'NO');

    // Test explicit stable versions
    await testModel('gemini-1.5-flash-001');
    await testModel('gemini-1.5-pro-001');
    await testModel('gemini-1.5-flash-002');
    await testModel('gemini-1.5-pro-002');

    // Test without version (just in case)
    await testModel('gemini-pro');

    console.log('\nDone.');
}

run();
