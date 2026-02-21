import fs from 'fs';
import path from 'path';
import { getRedisClient } from '../src/lib/redis-client';

async function main() {
    const WATCHER_LOG_PATH = path.join(process.cwd(), 'services/twitter-watcher/detected-calls.json');
    const redis = getRedisClient();

    if (!fs.existsSync(WATCHER_LOG_PATH)) {
        console.error("Watcher log not found");
        process.exit(1);
    }

    const rawData = fs.readFileSync(WATCHER_LOG_PATH, 'utf-8');
    let detectedCalls = [];
    try {
        detectedCalls = JSON.parse(rawData);
    } catch (e) {
        console.error("Error parsing watcher log, might be empty or corrupted");
        process.exit(1);
    }

    // Get all analyzed IDs from the global ZSET
    const GLOBAL_ANALYSES_ZSET = 'global:analyses:timestamp';
    const allRefs = await redis.zrange(GLOBAL_ANALYSES_ZSET, 0, -1);
    const analyzedIds = new Set(allRefs.map((ref: any) => ref.split(':')[1]));

    console.log(`Total analyzed calls in Redis (Global Index): ${analyzedIds.size}`);

    let newTweets = [];
    let updatedCount = 0;

    for (let call of detectedCalls) {
        if (analyzedIds.has(call.tweetId)) {
            if (!call.submitted) {
                call.submitted = true;
                updatedCount++;
            }
        } else {
            if (!call.submitted) {
                newTweets.push(call);
            }
        }
    }

    console.log(`Updated ${updatedCount} entries to 'submitted: true' in memory.`);
    console.log(`Found ${newTweets.length} truly new tweets not yet analyzed.`);

    // Write back the updated file
    fs.writeFileSync(WATCHER_LOG_PATH, JSON.stringify(detectedCalls, null, 2));
    console.log("Updated watcher log file.");

    if (newTweets.length > 0) {
        const OUTPUT_PATH = path.join(process.cwd(), 'session35_batch.json');
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(newTweets.map(t => t.url), null, 2));
        console.log(`Saved ${newTweets.length} truly new URLs to ${OUTPUT_PATH}`);
    }
}

main().catch(console.error).finally(() => process.exit());
