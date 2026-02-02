import { getTweet } from 'react-tweet/api';

async function main() {
    const tweetId = process.argv[2] || "2016865993050792090";
    console.log(`Inspecting tweet ${tweetId}...`);
    try {
        const tweet = await getTweet(tweetId);
        console.log(JSON.stringify(tweet, null, 2));
    } catch (e) {
        console.error(e);
    }
}
main();
