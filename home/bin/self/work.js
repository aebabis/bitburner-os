import { afkTracker } from './lib/tracking';
import { rmi } from './lib/rmi';
import { getStaticData, getPlayerData } from './lib/data-store';

// Only work for a faction if we can afford the
// base price of their most expensive augmentation.
// This is meant as a heuristic for the player
// having enough levels to do faction work effectively.
const getFactionToHelp = (ns) => {
    const { targetFaction, maxAugPrices, maxRepReqs } = getStaticData(ns);
    if (maxAugPrices == null)
        return null;
    const { factionRep = {} } = getPlayerData(ns);
    const money = ns.getServerMoneyAvailable('home');
    const moneyNeeded = maxAugPrices[targetFaction];
    const rep = factionRep[targetFaction] || 0;
    const repNeeded = maxRepReqs[targetFaction];
    if (money >= moneyNeeded && rep < repNeeded)
        return targetFaction;
    return null;
}

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const afkTime = afkTracker(ns);

    await rmi(ns, true)('/bin/self/apply.js');

    while (true) {
        const { ownedAugmentations } = getStaticData(ns);
        const faction = getFactionToHelp(ns);
        const player = ns.getPlayer();
        const stats = ['strength', 'defense', 'dexterity', 'agility', 'charisma'].map(s=>player[s]);
        const doneWithJoes = stats.every(stat => stat >= 5);
        const isAfk = afkTime() > 30000;
        const shouldFocus = (isAfk && ownedAugmentations &&
            ownedAugmentations.includes('Neuroreceptor Management Implant')).toString();
        if (!doneWithJoes) {
            await rmi(ns)('/bin/self/job.js', 1, shouldFocus);
        } else if (faction != null) {
            await rmi(ns)('/bin/self/faction-work.js', 1, faction, shouldFocus);
        } else if (isAfk) {
            await rmi(ns)('/bin/self/crime-stats.js');
            await rmi(ns)('/bin/self/crime.js');
        } else {
            await rmi(ns)('/bin/self/job.js', 1, shouldFocus);
        }
        await ns.sleep(100);
    }
}