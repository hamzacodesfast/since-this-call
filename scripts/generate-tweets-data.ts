
import { LocalRedisWrapper } from '../src/lib/redis-wrapper';

async function main() {
    const redis = new LocalRedisWrapper('http://localhost:8080');
    const users = await redis.smembers('all_users');
    const profiles: any[] = [];
    const tickerStats: Record<string, { t: number, b: number }> = {};

    for (const user of users) {
        const p: any = await redis.hgetall('user:profile:' + user);
        if (p && parseInt(p.totalAnalyses) >= 6) {
            profiles.push({
                u: p.username,
                wr: parseFloat(p.winRate),
                t: parseInt(p.totalAnalyses),
                w: parseInt(p.wins),
                l: parseInt(p.losses)
            });
        }

        const historyData = await redis.lrange('user:history:' + user, 0, -1);
        for (const item of historyData) {
            let h;
            try {
                h = typeof item === 'string' ? JSON.parse(item) : item;
            } catch (e) { continue; }
            if (!h || !h.symbol) continue;

            const sym = String(h.symbol).toUpperCase().trim();
            if (!tickerStats[sym]) {
                tickerStats[sym] = { t: 0, b: 0 };
            }
            tickerStats[sym].t++;
            if (h.sentiment === 'BULLISH') {
                tickerStats[sym].b++;
            }
        }
    }

    const top5 = [...profiles].sort((a, b) => b.wr - a.wr).slice(0, 5);
    const bottom5 = [...profiles].sort((a, b) => a.wr - b.wr).slice(0, 5);

    const sortedTickers = Object.entries(tickerStats)
        .map(([symbol, d]) => ({
            symbol,
            total: d.t,
            bullPct: Math.round((d.b / d.t) * 100)
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    const totalCalls = await redis.zcard('global:analyses:timestamp');
    const totalTickers = await redis.scard('tracked_tickers');

    console.log(JSON.stringify({
        top5,
        bottom5,
        sortedTickers,
        metrics: {
            calls: totalCalls,
            gurus: users.length,
            tickers: totalTickers,
            winRate: 47 // Hardcoded based on recent refresh-metrics output
        }
    }));
    process.exit(0);
}

main().catch(console.error);
