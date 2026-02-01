import { extractCallFromText } from '../src/lib/ai-extractor';
import 'dotenv/config';

// Load envs if needed (though ai-extractor uses Google provider which might need key)
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    console.log("🧪 Testing AI Context Hardening...\n");

    const cases = [
        {
            name: "Ambiguous Direction",
            text: "no context tweet- it could go up, it could go down",
            date: new Date().toISOString()
        },
        {
            name: "Fact Stating / Volume",
            text: "Silver volume is massive right now on the hourly.",
            date: new Date().toISOString()
        },
        {
            name: "Valid Signal (Control)",
            text: "Buying the dip on $BTC here. 90k is the floor.",
            date: new Date().toISOString()
        }
    ];

    for (const testCase of cases) {
        console.log(`--- Case: ${testCase.name} ---`);
        console.log(`Text: "${testCase.text}"`);
        try {
            const result = await extractCallFromText(testCase.text, testCase.date);
            if (result) {
                console.log(`RESULT: ${result.action} on ${result.ticker} (${result.confidence_score})`);
                console.log(`Reasoning: ${result.reasoning}`);
            } else {
                console.log(`RESULT: NULL (Correctly Filtered)`);
            }
        } catch (e) {
            console.error("Error:", e);
        }
        console.log("\n");
    }
}

main().catch(console.error);
