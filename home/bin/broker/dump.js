import { getConfig } from './lib/confg';
import { getStocks } from './bin/broker/api';

/** @param {NS} ns **/
export async function main(ns) {
    try {
        ns.tprint(`Selling all holdings and setting reserve proportion to 100%`);
        getConfig(ns).set('reserved-funds', 1);
        for (const stock of getStocks(ns))
            stock.sell(stock.position[0]);
    } catch(error) {
        console.error(error);
    }
}