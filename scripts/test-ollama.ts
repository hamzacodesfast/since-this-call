import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractCallFromText } from '../src/lib/ai-extractor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env - Try multiple locations
const envPaths = ['.env.local', '.env.production', '.env.production.local', '.env'];
let foundEnv = false;

for (const envFile of envPaths) {
    const fullPath = path.resolve(__dirname, `../${envFile}`);
    const result = dotenv.config({ path: fullPath });
    if (!result.error) {
        console.log(`✅ Loaded env from ${envFile}`);
        foundEnv = true;
    }
}

if (!foundEnv) {
    console.warn('⚠️ No .env file found. Using process.env defaults.');
}

async function testExtraction() {
    console.log('🧪 Testing Ollama Extraction...');
    console.log(`📡 Provider: ${process.env.AI_PROVIDER}`);
    console.log(`🤖 Model: ${process.env.OLLAMA_MODEL}`);
    console.log(`🔗 URL: ${process.env.OLLAMA_BASE_URL}`);

    const sampleTweet = "I'm loading up on more $SOL here at $140. Target is $250 by end of summer. Send it! #SOL #Crypto";
    const sampleDate = new Date().toISOString();

    try {
        const result = await extractCallFromText(sampleTweet, sampleDate, 'CryptoGuru');
        if (result) {
            console.log('✅ Extraction Success!');
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('ℹ️ Result was NULL (Noise filter or non-call).');
        }
    } catch (error: any) {
        console.error('❌ Extraction Failed:', error.message);
        if (error.message.includes('ECONNREFUSED')) {
            console.log('💡 Tip: Make sure Ollama is running (`ollama serve`).');
        }
    }
}

testExtraction();
