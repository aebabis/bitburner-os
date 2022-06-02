import { rmi } from './lib/rmi';
import { analyzeAugData } from './bin/self/aug/analyze';
import { getStaticData } from './lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const retry = true;

    await rmi(ns, retry)('/bin/self/aug/load-faction-favor.js');
    await rmi(ns, retry)('/bin/self/aug/load-owned-augs.js');
    await rmi(ns, retry)('/bin/self/aug/load-aug-names.js');
    await rmi(ns, retry)('/bin/self/aug/load-aug-prices.js');
    await rmi(ns, retry)('/bin/self/aug/load-aug-reps.js');
    await rmi(ns, retry)('/bin/self/aug/load-aug-prereqs.js');
    await rmi(ns, retry)('/bin/self/aug/load-aug-stats.js');

    await analyzeAugData(ns);

    while (true) {
        await rmi(ns, retry)('/bin/self/aug/join-factions.js');
        if (getStaticData(ns).targetFaction != null)
            await rmi(ns, retry)('/bin/self/aug/purchase-augs.js');
        await ns.sleep(100);
    }
}
