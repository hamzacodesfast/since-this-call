
import { getTweet } from 'react-tweet/api';

const TWEETS = [
    '2016953670030463363', // MB_Hogan (Bullish NBIS)
    '2016255717012078702', // MB_Hogan (Bullish NBIS)
    '2017057873470304764', // stevenmarkryan (Bullish TSLA)
    '2017451523329167635', // stevenmarkryan (Bullish TSLA)
    '2017569904866545917', // watchingmarkets (Bullish PENGUIN)
    '2017314110560411826', // watchingmarkets (Bullish PENGUIN)
    '2017314815685898719', // watchingmarkets (Bullish WOJAK)
    '2017612712340296040', // PeterSchiff (Bearish MSTR)
    '2016563244119347321', // PeterSchiff (Bearish BTC)
    '2017129959345762414', // Cryptolution (Bullish DOG)
    '2017329591262842951', // Cryptolution (Bullish DOG)
    '2017290243880456398'  // Cryptolution (Bullish DOG)
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
