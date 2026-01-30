
/**
 * A wrapper specifically for Local Redis using IORedis.
 * This mimics the Upstash Redis API so it can be used interchangeably.
 */
export class LocalRedisWrapper {
    private client: any;

    constructor(url: string) {
        console.log('🔌 Initializing Local Redis Wrapper (Lazy IORedis)...');
        try {
            const r = eval('require');
            const IORedis = r('ioredis');
            this.client = new IORedis(url.replace('http://', 'redis://').replace(':8080', ':6379'));
        } catch (e) {
            console.error('❌ Failed to load ioredis. Ensure it is installed for local dev.', e);
        }
    }

    async get(key: string): Promise<any> {
        const val = await this.client.get(key);
        try { return val ? JSON.parse(val) : null; } catch { return val; }
    }

    async set(key: string, value: any, options?: { ex?: number }): Promise<any> {
        const val = typeof value === 'object' ? JSON.stringify(value) : value;
        if (options?.ex) {
            return this.client.set(key, val, 'EX', options.ex);
        }
        return this.client.set(key, val);
    }

    async del(key: string | string[]): Promise<number> {
        if (Array.isArray(key)) return this.client.del(...key);
        return this.client.del(key);
    }

    async exists(key: string): Promise<number> {
        return this.client.exists(key);
    }

    async hgetall(key: string): Promise<Record<string, any> | null> {
        return this.client.hgetall(key);
    }

    async hset(key: string, value: Record<string, any>): Promise<number> {
        return this.client.hset(key, value);
    }

    async lrange(key: string, start: number, end: number): Promise<any[]> {
        const list = await this.client.lrange(key, start, end);
        return list.map((item: string) => {
            try { return JSON.parse(item); } catch { return item; }
        });
    }

    async lpush(key: string, ...elements: any[]): Promise<number> {
        const args = elements.map(e => typeof e === 'object' ? JSON.stringify(e) : e);
        return this.client.lpush(key, ...args);
    }

    async rpush(key: string, ...elements: any[]): Promise<number> {
        const args = elements.map(e => typeof e === 'object' ? JSON.stringify(e) : e);
        return this.client.rpush(key, ...args);
    }

    async lindex(key: string, index: number): Promise<any> {
        const val = await this.client.lindex(key, index);
        try { return val ? JSON.parse(val) : null; } catch { return val; }
    }

    async llen(key: string): Promise<number> {
        return this.client.llen(key);
    }

    async sadd(key: string, ...members: any[]): Promise<number> {
        return this.client.sadd(key, ...members);
    }

    async srem(key: string, ...members: any[]): Promise<number> {
        return this.client.srem(key, ...members);
    }

    async smembers(key: string): Promise<any[]> {
        return this.client.smembers(key);
    }

    async scard(key: string): Promise<number> {
        return this.client.scard(key);
    }

    async setnx(key: string, value: any): Promise<number> {
        const val = typeof value === 'object' ? JSON.stringify(value) : value;
        return this.client.setnx(key, val);
    }

    async zadd(key: string, member: { score: number, member: any }): Promise<number> {
        return this.client.zadd(key, member.score, member.member);
    }

    async zrange(key: string, start: number, stop: number, options?: { rev?: boolean, withScores?: boolean }): Promise<any[]> {
        if (options?.rev) {
            if (options.withScores) return this.client.zrevrange(key, start, stop, 'WITHSCORES');
            return this.client.zrevrange(key, start, stop);
        }
        if (options?.withScores) return this.client.zrange(key, start, stop, 'WITHSCORES');
        return this.client.zrange(key, start, stop);
    }

    async zcard(key: string): Promise<number> {
        return this.client.zcard(key);
    }

    async zrem(key: string, ...members: any[]): Promise<number> {
        return this.client.zrem(key, ...members);
    }

    async zrevrange(key: string, start: number, stop: number, options?: { withScores?: boolean }): Promise<any[]> {
        if (options?.withScores) {
            return this.client.zrevrange(key, start, stop, 'WITHSCORES');
        }
        return this.client.zrevrange(key, start, stop);
    }

    async flushdb(): Promise<string> {
        return this.client.flushdb();
    }

    pipeline() {
        return createPipelineProxy(this.client.pipeline());
    }
}

function createPipelineProxy(ioredisPipe: any) {
    return new Proxy(ioredisPipe, {
        get(target, prop) {
            if (prop === 'exec') {
                return async () => {
                    const results = await target.exec();
                    return results.map(([err, res]: [any, any]) => {
                        if (err) throw err;
                        return res;
                    });
                };
            }
            // Add translation for Upstash-style pipeline commands if needed
            if (prop === 'zadd') {
                return (key: string, member: { score: number, member: any }) => {
                    return target.zadd(key, member.score, member.member);
                };
            }
            return target[prop];
        }
    });
}
