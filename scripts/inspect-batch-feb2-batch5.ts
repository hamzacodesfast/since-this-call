
import { getTweet } from 'react-tweet/api';

const TWEETS = [
    '1993573426209210603', // LaMachina777 (SOL)
    '1991919787090563512', // LaMachina777 (BCH)
    '2015521196868026775', // MMatters22596 (Bearish AAPL)
    '2013569295507239100', // alc2022 (Bullish DUOL)
    '2017573315171287397', // polaris_xbt (Bearish BTC)
    '2017017770534486518', // DarioCpx (Bearish)
    '2016897478197448875', // ByzGeneral (Bearish)
    '2017185931019862255', // devchart (Bullish MEGA)
    '2013937479603126600', // devchart (Bullish)
    '2016534781245469036', // JamesWynnReal (Bullish PENGUIN)
    '2013824696845062492', // BrutalBtc (Bearish BTC Chart)
    '2013629563679424752', // ColinTCrypto (Bearish BTC)
    '2017297618322219364', // ChartingGuy (Bearish SLV)
    '2017261034579403196', // ChartingGuy (Bearish SLV)
    '2016984475121443158'  // ChartingGuy (Bearish COIN)
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
