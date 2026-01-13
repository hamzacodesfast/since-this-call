// In-memory store for recent analyses
// Note: Resets on server restart. Can be upgraded to Vercel KV for persistence.

export interface StoredAnalysis {
    id: string;          // Tweet ID
    username: string;
    author: string;
    avatar?: string;
    symbol: string;
    sentiment: 'BULLISH' | 'BEARISH';
    performance: number;
    isWin: boolean;
    timestamp: number;
}

const MAX_STORED = 50;
const recentAnalyses: StoredAnalysis[] = [];

export function addAnalysis(analysis: StoredAnalysis): void {
    // Add to beginning of array
    recentAnalyses.unshift(analysis);

    // Trim to max size
    if (recentAnalyses.length > MAX_STORED) {
        recentAnalyses.pop();
    }
}

export function getRecentAnalyses(limit: number = 20): StoredAnalysis[] {
    return recentAnalyses.slice(0, limit);
}

export function getAnalysisCount(): number {
    return recentAnalyses.length;
}
