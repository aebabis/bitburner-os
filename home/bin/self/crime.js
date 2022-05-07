import { getPlayerData  } from './lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const { crimeStats } = getPlayerData(ns);
    const PATIENCE = 90 * 1000;
    const allowedCrimes = crimeStats
        .filter(c=>c.chance===1 || c.chance>=c.time/PATIENCE);
    if (allowedCrimes.some(c => c.name === 'Homicide') && ns.getPlayer().numPeopleKilled < 30) {
        ns.commitCrime('Homicide');
    } else {
        const bestCrime = allowedCrimes
            .reduce((a, b) => a.expectedValue>b.expectedValue?a:b);
        ns.commitCrime(bestCrime.name);
    }
    while (ns.isBusy())
        await ns.sleep(100);
}