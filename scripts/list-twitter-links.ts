import { getRedisClient } from '../src/lib/redis-client';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const redis = getRedisClient();
    console.log('🔗 Fetching all user profiles...');

    const allUsers = await redis.smembers('all_users') as string[];
    console.log(`📊 Found ${allUsers.length} profiles.`);

    const links = allUsers
        .sort()
        .map(username => `https://x.com/${username}`);

    const outputPath = path.resolve(process.cwd(), 'docs/twitter_profiles.txt');
    fs.writeFileSync(outputPath, links.join('\n'));

    console.log(`✅ Success! ${links.length} Twitter links saved to:`);
    console.log(`   ${outputPath}`);

    process.exit(0);
}

main().catch(console.error);
