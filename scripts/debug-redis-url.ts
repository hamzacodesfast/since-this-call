import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const url = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const prodUrl = process.env.PROD_UPSTASH_REDIS_REST_KV_REST_API_URL || '';
console.log('Primary URL:', url?.substring(0, 40) + '...');
console.log('Prod URL:', prodUrl?.substring(0, 40) + '...');
console.log('Are they the same?', url === prodUrl);
process.exit(0);
