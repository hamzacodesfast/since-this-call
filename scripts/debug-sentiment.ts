
import { extractCallFromText } from '../src/lib/ai-extractor';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    const text = "sidelined bros will all in around 111k+ and get liquidated right before the next ATH lmao ... this pump is not mythologia";
    const date = new Date().toISOString();

    console.log("Analyzing text:", text);
    const result = await extractCallFromText(text, date);
    console.log("Result:", JSON.stringify(result, null, 2));
}

debug();
