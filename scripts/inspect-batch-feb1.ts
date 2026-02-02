
import { getTweet } from 'react-tweet/api';

const TWEETS = [
    '2017206400347251174', // StonkChris - Bearish
    '2013359893537857841', // lynk0x - Bearish $whitewhale
    '2016251281162006886', // ciniz - Bearish
    '2017213400363790434', // RealSimpleAriel - Bearish
    '2013727702021239250', // HolySmokas - Bullish
    '2017277409410863179', // xLabundahx - Bullish $dog
    '2015496762723582005', // cryptomacavalli - Bullish $rose
    '2015245096716062726'  // voidsnam - Bullish
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
