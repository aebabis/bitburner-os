import { rmi } from './lib/rmi';
import { analyzeAugData } from './bin/self/aug/analyze';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const retry = true;

    await rmi(ns, retry)('/bin/self/aug/load-owned-augs.js');
    await rmi(ns, retry)('/bin/self/aug/load-aug-names.js');
    await rmi(ns, retry)('/bin/self/aug/load-aug-prices.js');
    await rmi(ns, retry)('/bin/self/aug/load-aug-reps.js');
    await rmi(ns, retry)('/bin/self/aug/load-aug-prereqs.js');
    await rmi(ns, retry)('/bin/self/aug/load-aug-stats.js');

    analyzeAugData(ns);

    while (true) {
        await rmi(ns, retry)('/bin/self/aug/join-factions.js');
        await rmi(ns, retry)('/bin/self/aug/purchase-augs.js');
        await ns.sleep(100);
    }
}