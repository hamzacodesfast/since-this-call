
import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function inspectRecent() {
    const redis = getRedisClient();
    const data = await redis.lrange('recent_analyses', 0, 10);
    const analyses = data.map((item: any) =>
        typeof item === 'string' ? JSON.parse(item) : item
    );

    console.log(JSON.stringify(analyses, null, 2));
    process.exit(0);
}

inspectRecent();
