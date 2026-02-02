import { extractCallFromText } from '../src/lib/ai-extractor';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    const texts = [
        `$SPX Every single time we see a big gap down or a nasty red candlestick... buyers come in with the big scoop buy like it was a Baskin Robbin's ice cream on a hot sunny day...

At some point....?! https://t.co/x5K0ymYKVn`,
        `$BABA $180.75 highs today.\n\nJust give me $200.\n\nDon’t make me whip out the trampoline…`,
        `$SOFI reports tomorrow morning.\n\nWe buying here fam?`,
        `$TSLA poppin’ a bit in after hrs that SpaceX could merge with Tesla.\n\nWhoa…`,
        `$GOOG Went from the cheapest Maggy 7, on a forward p/e basis, last year to now the most expensive Maggy 7 currently. \n\nIt is the only Maggy 7 trading at ATH’s while the rest are all well off their ATH’s\n\nEarnings this Wednesday.\n\nOptions implying about a +/- 6.5% move.\n\nIs it`,
        `$META $730. Held the overnight gains. Impressed.\n\nNow if you ring the register and take profits, I do not blame ya.\n\nMaybe let a little position ride towards that $751 potential gap fill.\n\nBut again, no one ever went broke taking a profit.`,
        `$SPX 6000.\n\n$ES 6000.\n\nPhew. Buyers held. Just barely.`,
        `$AAPL $259. \n\nHeld up well today despite QQQ down almost 2%.`,
        `$APP $482’s today. Wow what a drop.\n\nSee Heisenberg is not a permabull.\n\nI do call out shorts too!`,
        `$BMNR -85% from ATH’s.\n\nBut if you don’t count that parabolic spike from July 2025, then it is -65% from the second highest peak.\n\nNot good…`,
        `February has historically been a tough trade.\n\nOver 50 years of $SPX:\n🔻 55% win rate 🔻 −0.02% average return\n\nSecond-worst month after September.`,
        `Fill the gap, then let's talk. $MSFT`,
        `Over 80% of companies have reported Q4 earnings so far.\n\n$SPX performance by sector:\n\nCommunication Svcs: +5.53% 🚀\nUtilities: -1.82%\nReal Estate: -1.75%\nFinancials: -1.25%\nHealth Care: -1.20%\nTech: -0.58%\nEnergy: -0.45%\nCons Discretionary: -0.21%\nMaterials: +0.02%\nIndustrials: +0.13%\nCons Staples: +0.47%`
    ];
    const date = new Date().toISOString();

    for (const text of texts) {
        console.log("\nTesting text:");
        console.log(text);
        console.log("--- RESULT ---");

        try {
            const result = await extractCallFromText(text, date);
            if (result) {
                console.log(`Action: ${result.action}`);
                console.log(`Reasoning: ${result.reasoning}`);
            } else {
                console.log("Action: NULL (Correctly filtered/ignored)");
            }
        } catch (e) {
            console.error(e);
        }
    }
}

main();
