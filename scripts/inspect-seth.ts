
import { getTweet } from 'react-tweet/api';

const TWEETS = [
    '2017054301655327030', // Failed (NULL)
    '2017606376193655048'  // Classified as SELL
];

async function inspect() {
    for (const id of TWEETS) {
        try {
            const t = await getTweet(id);
            console.log(`\nID: ${id}`);
            console.log(`Text: ${t ? t.text : 'FAILED_TO_FETCH'}`);
        } catch (e) {
            console.log(`ID: ${id} - Error fetching: ${e}`);
        }
    }
}
inspect();
