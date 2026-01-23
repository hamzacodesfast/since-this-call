
/**
 * A wrapper specifically for Local Redis using IORedis.
 * This mimics the Upstash Redis API so it can be used interchangeably.
 */
export class LocalRedisWrapper {
    private client: any;

    constructor(url: string) {
        console.log('🔌 Initializing Local Redis Wrapper (Lazy IORedis)...');
        try {
            // Dynamic require via eval to strictly prevent Webpack from bundling ioredis in production
            // This is necessary because Vercel/Next.js will statically analyze 'require' and include it.
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

    async set(key: string, value: any): Promise<any> {
        const val = typeof value === 'object' ? JSON.stringify(value) : value;
        return this.client.set(key, val);
    }

    async del(key: string): Promise<number> {
        return this.client.del(key);
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

    async flushdb(): Promise<string> {
        return this.client.flushdb();
    }

    pipeline() {
        return createPipelineProxy(this.client.pipeline());
    }
}

// Better approach: Return a Proxy that intercepts 'exec'
function createPipelineProxy(ioredisPipe: any) {
    return new Proxy(ioredisPipe, {
        get(target, prop) {
            if (prop === 'exec') {
                return async () => {
                    const results = await target.exec();
                    // Map [error, result] -> result, throwing error if present
                    return results.map(([err, res]: [any, any]) => {
                        if (err) throw err;
                        return res;
                    });
                };
            }
            return target[prop];
        }
    });
}
