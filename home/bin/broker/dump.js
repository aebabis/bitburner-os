import { getConfig } from '/lib/config';
import { getStaticData } from '/lib/data-store';

/** @param {NS} ns **/
export async function main(ns) {
    try {
        const { stocks } = getStaticData(ns);
        ns.tprint(`Selling all holdings and setting reserve proportion to 100%`);
        getConfig(ns).set('reserved-funds', 1);
        for (const { sym } of stocks)
            ns.stock.sellStock(sym, Infinity);
    } catch(error) {
        console.error(error);
    }
}
