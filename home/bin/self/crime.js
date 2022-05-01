import { getPlayerData  } from './lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const { crimeStats } = getPlayerData(ns);
    const bestCrime = crimeStats
        .filter(c=>c.chance>=.5)
        .reduce((a, b) => a.expectedValue>b.expectedValue?a:b);
    ns.commitCrime(bestCrime.name);
    while (ns.isBusy())
        await ns.sleep(100);
}