import { getTweet } from 'react-tweet/api';

async function testFetch() {
    const id = '2005623836746953045'; // The ID related to the error
    console.log(`Fetching tweet ${id}...`);
    try {
        const tweet = await getTweet(id);
        if (tweet) {
            console.log('Text:', tweet.text);
            console.log('Date:', tweet.created_at);
        } else {
            console.log('Tweet is NULL');
        }
    } catch (e) {
        console.error('Fetch Error:', e);
    }
}

testFetch();
