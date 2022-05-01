import { afkTracker } from './lib/tracking';
import { rmi } from './lib/rmi';
import { getStaticData, getPlayerData } from './lib/data-store';

// Only work for a faction if we can afford the
// base price of their most expensive augmentation.
// This is meant as a heuristic for the player
// having enough levels to do faction work effectively.
const getFactionToHelp = (ns) => {
    const { targetFaction, maxAugPrices, maxRepReqs } = getStaticData(ns);
    const { factionRep = {} } = getPlayerData(ns);
    const money = ns.getServerMoneyAvailable('home');
    const moneyNeeded = maxAugPrices[targetFaction];
    const rep = factionRep[targetFaction] || 0;
    const repNeeded = maxRepReqs[targetFaction];
    ns.tprint([money, moneyNeeded, rep, repNeeded, money >= moneyNeeded, rep < repNeeded]);
    if (money >= moneyNeeded && rep < repNeeded)
        return targetFaction;
    return null;
}

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const isAfk = afkTracker(ns);

    await rmi(ns, true)('/bin/self/apply.js');

    while (true) {
        if (isAfk()) {
            const faction = getFactionToHelp(ns);
            const player = ns.getPlayer();
            const stats = ['strength', 'defense', 'dexterity', 'agility', 'charisma'].map(s=>player[s]);
            const doneWithJoes = stats.every(stat => stat >= 5);
            if (!doneWithJoes) {
                await rmi(ns)('/bin/self/job.js');
            } else if (faction != null) {
                await rmi(ns)('/bin/self/faction-work.js', 1, faction);
            } else {
                await rmi(ns)('/bin/self/crime-stats.js');
                await rmi(ns)('/bin/self/crime.js');
            }
        }
        await ns.sleep(100);
    }
}