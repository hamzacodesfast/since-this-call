
import * as http from 'http';
import Redis from 'ioredis';

const REDIS_HOST = '127.0.0.1';
const REDIS_PORT = 6379;
const PROXY_PORT = 8080;

const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
});

const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const isBatch = Array.isArray(data[0]);
                const commands = isBatch ? data : [data];

                const results = await Promise.all(commands.map(async (cmdArgs) => {
                    const [command, ...args] = cmdArgs;
                    const cmdLower = command.toLowerCase();
                    console.log(`[Proxy] Executing: ${command} ${JSON.stringify(args)}`);
                    try {
                        function sanitize(val: any): any {
                            if (Buffer.isBuffer(val)) return val.toString('utf8');
                            if (Array.isArray(val)) return val.map(sanitize);
                            if (val && typeof val === 'object') {
                                const obj: any = {};
                                for (const [k, v] of Object.entries(val)) {
                                    obj[k] = sanitize(v);
                                }
                                return obj;
                            }
                            return val;
                        }

                        let result = sanitize(await redis.call(command, ...args));

                        // Transform HGETALL object to [k, v, k, v] array for Upstash client compatibility
                        if (cmdLower === 'hgetall' && result && typeof result === 'object' && !Array.isArray(result)) {
                            const arr = [];
                            for (const [k, v] of Object.entries(result)) {
                                arr.push(k, v);
                            }
                            console.log(`[Proxy] Transformed HGETALL for ${args[0]} - ${arr.length} items`);
                            result = arr;
                        }

                        return { result };
                    } catch (err: any) {
                        console.error(`[Proxy] Redis Error: ${err.message}`);
                        return { error: err.message };
                    }
                }));

                if (isBatch) {
                    res.end(JSON.stringify(results));
                } else {
                    res.end(JSON.stringify(results[0]));
                }
            } catch (e: any) {
                console.error(`[Proxy] Server Error: ${e.message}`);
                res.statusCode = 400;
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Only POST supported' }));
    }
});

server.listen(PROXY_PORT, () => {
    console.log(`🚀 Upstash-Local Proxy v4 (ioredis) running at http://localhost:${PROXY_PORT}`);
});
