
import { getTweet } from 'react-tweet/api';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    const id = '2011205566002008395';
    try {
        const tweet = await getTweet(id);
        if (tweet) {
            console.log("Tweet Found:");
            console.log(`Text: ${tweet.text}`);
            console.log(`User: @${tweet.user.screen_name}`);
        } else {
            console.log("Tweet not found");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
debug();
