import { getPlayerData, putPlayerData  } from '/lib/data-store';

const selectCrime = (ns) => {
    const { crimeStats } = getPlayerData(ns);
    if (crimeStats == null)
        return 'Shoplift';

    const homicide = crimeStats.find(c=>c.name==='Homicide');
    if (homicide.chance > .5 && ns.getPlayer().numPeopleKilled < 30)
        return 'Homicide';

    const PATIENCE = 90 * 1000;
    const allowedCrimes = crimeStats
        .filter(c=>c.chance===1 || c.chance>=c.time/PATIENCE);
    
    const bestCrime = allowedCrimes
        .reduce((a, b) => a.expectedValue>b.expectedValue?a:b);
    
    return bestCrime.name;
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');

    const crime = selectCrime(ns);
    const duration = ns.singularity.commitCrime(crime);
    putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
    await ns.sleep(duration);
    putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
}
