
import { getTweet } from 'react-tweet/api';

const TWEETS = [
    '2016946085391192481', // miragemunny (BUTTCOIN)
    '2017092726043660487', // miragemunny (BUTTCOIN)
    '2017353343681663142', // fundstrat (BMNR)
    '2016990759166034052', // RJCcapital (SNDK)
    '1995333381115298072', // frankdegods (Bearish)
    '2013546160611361009', // i_bot404 (Bullish BTC)
    '2015093828785770632', // CyclesFan (Bearish MSFT)
    '2016150414631321705', // Axel_bitblaze69 (Bearish)
    '2011251414891446574', // Aster_DEX (Bullish)
    '2013612674953691209', // Aster_DEX (Bullish)
    '2017393418255909013', // greenytrades (Bearish)
    '2016829787290161653'  // saxena_puru (Bearish SLV)
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
