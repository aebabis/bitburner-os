import { afkTracker } from './lib/tracking';
import { rmi } from './lib/rmi';
import { getStaticData, getPlayerData, getMoneyData } from './lib/data-store';
import getConfig from './lib/config';
import {
    COMBAT_REQUIREMENTS,
    CITY_FACTIONS,
    FACTION_LOCATIONS,
} from './bin/self/aug/factions';

const COMBAT_STATS = ['strength', 'defense', 'dexterity', 'agility'];

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    const afkTime = afkTracker(ns);

    await rmi(ns, true)('/bin/self/apply.js');

    while (true) {
        const player = ns.getPlayer();
        const { ownedAugmentations, targetFaction, repNeeded } = getStaticData(ns);
        const { factionRep = {} } = getPlayerData(ns);
        const { costOfNextAugmentation } = getMoneyData(ns);

        const inTargetFaction = player.factions.includes(targetFaction);
        const isFactionGang = ns.gang.inGang() && ns.gang.getGangInformation().faction === targetFaction;
        const rep = factionRep[targetFaction] || 0;

        const isAfk = afkTime() > 20000;
        const shouldFocus = isAfk && ownedAugmentations &&
            !ownedAugmentations.includes('Neuroreceptor Management Implant');

        const makeMoney = async () => {
            if (isAfk) {
                await rmi(ns)('/bin/self/crime-stats.js');
                await rmi(ns)('/bin/self/crime.js');
            } else {
                await rmi(ns)('/bin/self/job.js', 1, shouldFocus);
            }
        };

        const getStatToTrain = lvlReq => COMBAT_STATS.find(stat => player[stat] < lvlReq);

        const getFactionStat = (targetFaction) => {
            if (isFactionGang)
                return null;
            const combatRequirement = COMBAT_REQUIREMENTS[targetFaction] || 0;
            return getStatToTrain(combatRequirement);
        };

        const statForCrimeTraining = getStatToTrain(5);
        if (statForCrimeTraining != null) {
            if (player.money > 25000)
                await rmi(ns)('/bin/self/improvement.js', 1, statForCrimeTraining, shouldFocus);
            else
                await rmi(ns)('/bin/self/job.js', 1, shouldFocus);
        } else if (player.money < costOfNextAugmentation) {
            // Doing crime until money would cover first aug
            // is a heuristic for having enough levels to rep-up.
            await makeMoney();
        } else {
            const statToTrain = getFactionStat(targetFaction);
            const requiredLocations = FACTION_LOCATIONS[targetFaction] || CITY_FACTIONS;
            if (statToTrain != null)
                await rmi(ns)('/bin/self/improvement.js', 1, statToTrain, shouldFocus);
            else if (!inTargetFaction && !requiredLocations.includes(player.city))
                await rmi(ns)('/bin/self/travel.js', 1, requiredLocations[0]);
            else if (inTargetFaction && !isFactionGang && rep < repNeeded) {
                getConfig(ns).set('share', .1);
                await rmi(ns)('/bin/self/faction-work.js', 1, targetFaction, shouldFocus);
            } else {
                getConfig(ns).set('share', 0);
                await makeMoney();
            }
        }
        await ns.sleep(100);
    }
}