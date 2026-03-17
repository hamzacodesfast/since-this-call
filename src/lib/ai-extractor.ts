import { generateObject } from 'ai';
import { z } from 'zod';

export const CallSchema = z.object({
    ticker: z.string().describe('The stock ticker or major crypto symbol (e.g. BTC, NVDA, ETH).'),
    action: z.enum(['BUY', 'SELL', 'NULL']).describe('The action/sentiment of the AUTHOR. Return BUY or SELL. Use NULL if no trade.'),
    confidence_score: z.number().describe('Confidence (0.0 to 1.0). If you think in percentages, divide by 100.'),
    timeframe: z.enum(['SHORT_TERM', 'LONG_TERM', 'UNKNOWN']).describe('Predicted timeframe.'),
    is_sarcasm: z.boolean().describe('Whether the tweet uses sarcasm.'),
    reasoning: z.string().describe('Brief explanation.'),
    warning_flags: z.array(z.string()).describe('Warning flags.'),
    type: z.enum(['CRYPTO', 'STOCK']).describe('Asset type.'),
    date: z.string().describe('ISO date of the call.'),
});

export type CallData = z.infer<typeof CallSchema>;

export async function extractCallFromText(
    tweetText: string,
    tweetDate: string,
    username?: string,
    imageUrl?: string,
    typeOverride?: 'CRYPTO' | 'STOCK',
    marketContext?: Record<string, number>
): Promise<CallData | null> {

    try {
        // 0. Pre-filter Noise (Deterministic)
        const upperText = tweetText.toUpperCase();
        const NOISE_PHRASES = [
            'LIVE SHOW', 'LIVE NOW', 'JOIN US', 'STREAMING NOW', 'TWITTER SPACE', 'BREAKING NEWS',
            'TRADE OF THE WEEK', 'WEEKLY RECAP'
        ];

        if (NOISE_PHRASES.some(phrase => upperText.includes(phrase))) {
            console.log('[AI-Extractor] Blocked by Noise Filter:', tweetText.substring(0, 50));
            return null;
        }

        const promptText = `
        ROLE: Financial Analyst. 
        TASK: Extract financial signals (BUY/SELL) for major assets.
        
        TWEET: "${tweetText}"
        AUTHOR: "${username || 'Unknown'}"
        DATE: "${tweetDate}"
        
        RULES:
        1. Action: BUY (Long), SELL (Short), NULL (No trade).
           - **SCHIFF RULE**: If author is "PeterSchiff" and mentions BTC/Bitcoin/MSTR, Action: "SELL".
        2. Ticker: Symbol only (BTC, NVDA, SOL). 
        3. Confidence: Use 0.0 to 1.0 scale. 
        
        CONSTRAINTS:
        - Return NULL for meme coins, news, or ambiguity.
        - Return NULL for factual statements without a prediction.
        
        OUTPUT: Return valid JSON matching the schema.
        `;

        const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1';
        const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2:1b';

        const { createOpenAI } = await import('@ai-sdk/openai');
        const ollama = createOpenAI({ 
            baseURL: ollamaBaseUrl,
            apiKey: 'ollama' 
        });

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const { object } = await generateObject({
                    model: ollama(ollamaModel),
                    schema: CallSchema,
                    prompt: promptText,
                });

                // 1B Model Post-Processing: Normalize confidence_score if > 1
                if (object.confidence_score > 1) {
                    object.confidence_score = object.confidence_score / 100;
                }
                
                // Cap at 1.0 and floor at 0.0
                object.confidence_score = Math.max(0, Math.min(1, object.confidence_score));

                if (object.action === 'NULL') return null;
                return object;

            } catch (error: any) {
                console.error(`[AI-Extractor] Attempt failed with ${ollamaModel}:`, error.message);
                if (attempt === 1) throw error;
            }
        }

        return null;

    } catch (error: any) {
        console.error('[AI-Extractor] Fatal:', error);
        // Do not mask specific errors unless it's a connection/timeout issue
        if (error.message?.includes('connect') || error.message?.includes('fetch') || error.message?.includes('timeout')) {
            throw new Error('Failed to analyze tweet. The AI service is currently unavailable.');
        }
        throw error;
    }
}
