
import * as dotenv from 'dotenv';
import * as path from 'path';
import { extractCallFromText } from '../src/lib/ai-extractor';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runTests() {
    console.log('🧪 Testing Context Engine (Chief Linguistic Officer)...\n');

    const testCases = [
        {
            name: 'Sarcasm (Clown Rule)',
            text: 'Imagine not owning BTC at this price 🤡',
            expected: { ticker: 'BTC', action: 'BUY', is_sarcasm: true }
        },
        {
            name: 'Conditional logic (Hypothesis)',
            text: 'Buying if we reclaim 40k',
            expected: null // NULL action should return null
        },
        {
            name: 'Active Call',
            text: 'Aping here. Stop loss at 39k',
            expected: { action: 'BUY' }
        },
        {
            name: 'Nicknames (Entity Resolution)',
            text: "Saylor's bags are heavy",
            expected: { ticker: 'MSTR' }
        },
        {
            name: 'Slang (Inverse Logic)',
            text: "Printer go brrr",
            expected: { action: 'BUY' }
        },
        {
            name: 'Inverse Logic (Ruined)',
            text: "I am ruined",
            expected: { action: 'BUY' } // Assuming he was long and it went down, intent was bullish
        },
        {
            name: 'Nickname (Golden Arches)',
            text: 'Golden Arches looking like a snack',
            expected: { ticker: 'MCD' }
        },
        {
            name: 'Nickname (Vitalik)',
            text: "Vitalik's coin is dead",
            expected: { ticker: 'ETH', action: 'SELL' }
        },
        {
            name: 'Sarcasm (Skull Emoji)',
            text: "Imagine selling BTC before the parabolic move 💀",
            expected: { action: 'BUY', is_sarcasm: true }
        },
        {
            name: 'Nickname (Hyperliquid)',
            text: 'HL is going to the moon',
            expected: { ticker: 'HYPE', action: 'BUY' }
        },
        {
            name: 'Conditional (Wait for drop)',
            text: 'I become a buyer of SOL at $150',
            expected: null
        }
    ];

    for (const test of testCases) {
        console.log(`Testing: "${test.text}"`);
        try {
            const result = await extractCallFromText(test.text, new Date().toISOString());
            if (test.expected === null) {
                if (result === null) {
                    console.log(`✅ Passed: Correctly identified as NULL/Conditional\n`);
                } else {
                    console.error(`❌ Failed: Expected NULL but got ${JSON.stringify(result)}\n`);
                }
            } else {
                if (!result) {
                    console.error(`❌ Failed: Expected result but got NULL\n`);
                    continue;
                }

                let passed = true;
                for (const [key, value] of Object.entries(test.expected)) {
                    if (result[key as keyof typeof result] !== value) {
                        console.error(`❌ Failed ${key}: Expected ${value} but got ${result[key as keyof typeof result]}`);
                        passed = false;
                    }
                }
                if (passed) {
                    console.log(`✅ Passed: ${test.name}\n`);
                } else {
                    console.log(`Full result: ${JSON.stringify(result, null, 2)}\n`);
                }
            }
        } catch (error: any) {
            console.error(`❌ Error testing "${test.text}":`, error.message);
        }
    }
}

runTests();
