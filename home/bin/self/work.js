import { afkTracker } from './lib/tracking';
import { rmi } from './lib/rmi';
import { getStaticData, getPlayerData } from './lib/data-store';
import getConfig from './lib/config';
import {
    COMBAT_REQUIREMENTS,
    CITY_FACTIONS,
    FACTION_LOCATIONS,
} from './bin/self/aug/factions';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const afkTime = afkTracker(ns);

    await rmi(ns, true)('/bin/self/apply.js');

    while (true) {
        const player = ns.getPlayer();
        const { ownedAugmentations, targetFaction, maxAugPrices, maxRepReqs } = getStaticData(ns);
        const { factionRep = {} } = getPlayerData(ns);

        const inTargetFaction = player.factions.includes(targetFaction);
        const moneyNeeded = maxAugPrices[targetFaction];
        const rep = factionRep[targetFaction] || 0;
        const repNeeded = maxRepReqs[targetFaction];

        const stats = ['strength', 'defense', 'dexterity', 'agility', 'charisma'].map(s=>player[s]);
        const doneWithJoes = stats.every(stat => stat >= 5);
        const isAfk = afkTime() > 30000;
        const shouldFocus = isAfk && ownedAugmentations &&
            !ownedAugmentations.includes('Neuroreceptor Management Implant');

        const doCrime = async () => {
            if (isAfk) {
                await rmi(ns)('/bin/self/crime-stats.js');
                await rmi(ns)('/bin/self/crime.js');
            } else {
                await rmi(ns)('/bin/self/job.js', 1, shouldFocus);
            }
        };

        if (!doneWithJoes) {
            await rmi(ns)('/bin/self/job.js', 1, shouldFocus);
        } else if (player.money < moneyNeeded) {
            await doCrime();
        } else {
            // Only work for a faction if we can afford the
            // base price of their most expensive augmentation.
            // This is meant as a heuristic for the player
            // having enough levels to do faction work effectively.
            const combatStats = ['strength', 'defense', 'dexterity', 'agility'];
            const combatRequirement = COMBAT_REQUIREMENTS[targetFaction] || 0;
            const statToTrain = combatStats.find(stat => player[stat] < combatRequirement);
            const requiredLocations = FACTION_LOCATIONS[targetFaction] || CITY_FACTIONS;
            if (statToTrain != null)
                await rmi(ns)('/bin/self/improvement.js', 1, statToTrain, shouldFocus);
            else if (!inTargetFaction && !requiredLocations.includes(player.city))
                await rmi(ns)('/bin/self/travel.js', 1, requiredLocations[0]);
            else if (inTargetFaction && rep < repNeeded) {
                getConfig(ns).set('share', .1);
                await rmi(ns)('/bin/self/faction-work.js', 1, targetFaction, shouldFocus);
            } else {
                getConfig(ns).set('share', 0);
                await doCrime();
            }
        }
        await ns.sleep(100);
    }
}