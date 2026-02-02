
import { getTweet } from 'react-tweet/api';

const TWEETS = [
    '1864501831507890634', // cobie
    '1944638949944607020', // cobie
    '2013960444126662984', // CryptoKid
    '2017522276271374550', // DegenerateNews
    '2013930674722361407', // DegenerateNews
    '2015062028889796928', // alphacharts365
    '2017311543805788593', // theunipcs (USELESS)
    '2014069322553974892', // altbullx
    '2016895412259434518', // Jova_Beta (DOG)
    '2015457371426886125', // comic (MSTR)
    '2017227517275549940', // OccamiCrypto (MSTR)
    '2017001994125504991'  // ZeeContrarian1 (BMNR)
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
