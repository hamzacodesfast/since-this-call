
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
    // Note: listModels is not directly available on the root class in some versions, 
    // but we can try to use the fetch endpoint or just assume standard names if this fails.
    // Actually, let's just use the REST API manually to be sure.

    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

    console.log('Fetching models from:', url);
    const res = await fetch(url);
    const data = await res.json();

    if (data.models) {
        console.log('Available Models:');
        data.models.forEach((m: any) => {
            console.log(`- ${m.name} (${m.displayName})`);
        });
    } else {
        console.error('Failed to list models:', data);
    }
}

main().catch(console.error);
