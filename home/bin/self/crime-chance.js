import { getPlayerData, putPlayerData  } from './lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const crimeStats = getPlayerData(ns).crimeStats.map((stats) => {
        const { money, time } = stats;
        const chance = ns.getCrimeChance(stats.name);
        return ({
            ...stats, chance, expectedValue: chance * money / time,
        });
    });
    putPlayerData(ns, { crimeStats });
}