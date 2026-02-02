
import { getTweet } from 'react-tweet/api';

const TWEETS = [
    '2015074967998562320', // RyansMethod
    '2016903318530859050', // swisstrader09
    '2013786944061555157', // DonAlt
    '2013916831178789091', // cryptochimpanz
    '2012578948857708727', // pedrosilva
    '2009180594866135519', // gh0stee
    '2017081433039524010', // Relentless_btc
    '2013654293837160683', // Taran_ss
    '2017318788874514853', // Wild_Randomness
    '2005623836746953045', // TheRealNomics
    '2012865058976469498', // cryptojack4u
    '2015225234350280742', // cburniske
    '2017020683835121734', // GerberKawasaki
    '2016206846051188840', // DeepInference
    '2016891504527090157', // APompliano
    '2013267101373419921', // MarktQuant
    '2016205378904641897', // BobLoukas
    '2015109181540294910', // StockChaser_
    '2017246551454757147', // stoolpresidente
    '2014934078697701781', // Tradermayne
    '2013346180252529067'  // MaxBecauseBTC
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
