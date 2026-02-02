
import { getTweet } from 'react-tweet/api';

const TWEETS = [
    '2017348329286271206', // gnoble79 (Bearish OPEN Meme)
    '2017349388696199274', // gnoble79 (Bearish OPEN Mocking)
    '2016289473424678925'  // HostileCharts (Bearish IGV)
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
