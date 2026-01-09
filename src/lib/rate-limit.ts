export interface RateLimitConfig {
    interval: number; // Window size in ms
    uniqueTokenPerInterval: number; // Max users to track (LRU-like)
}

export function rateLimit(config: RateLimitConfig) {
    const tokenCache = new Map<string, number[]>();

    return {
        check: (limit: number, token: string) => {
            const now = Date.now();
            const windowStart = now - config.interval;

            const timestampCache = tokenCache.get(token) || [];

            // Filter out timestamps older than the window
            const validTimestamps = timestampCache.filter(timestamp => timestamp > windowStart);

            if (validTimestamps.length >= limit) {
                return false;
            }

            // Valid request, record timestamp
            validTimestamps.push(now);
            tokenCache.set(token, validTimestamps);

            // Basic cleanup (LRU-ish)
            // If cache gets too big, simply clear it. 
            // In a real serverless environment, this map is ephermeral anyway.
            if (tokenCache.size > config.uniqueTokenPerInterval) {
                tokenCache.clear();
            }

            return true;
        }
    };
}
