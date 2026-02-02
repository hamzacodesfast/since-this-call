
import { getTweet } from 'react-tweet/api';

const TWEETS = [
    '2013653749131022716',
    '2014091925092180287',
    '2016955310871892237',
    '2013390022506864827'
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
