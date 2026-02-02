
import { getTweet } from 'react-tweet/api';

const TWEETS = [
    '2017449448977080394',
    '2012897891904344555',
    '2017264183062962546',
    '2013643730289397985',
    '2013300867684762100'
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
