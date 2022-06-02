import { getStaticData, getPlayerData } from './lib/data-store';
import { isMoneyBound, getRepNeeded } from './lib/query-service';
import { rmi } from './lib/rmi';
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

    await rmi(ns, true)('/bin/self/apply.js');

    while (true) {
        const player = ns.getPlayer();
        const { targetFaction } = getStaticData(ns);
        const { isPlayerActive, factionRep = {} } = getPlayerData(ns);

        const inTargetFaction = player.factions.includes(targetFaction);
        const isFactionGang = ns.gang.inGang() && ns.gang.getGangInformation().faction === targetFaction;
        const rep = factionRep[targetFaction] || 0;

        const makeMoney = async () => {
            if (isPlayerActive) {
                await rmi(ns)('/bin/self/job.js', 1);
            } else {
                await rmi(ns)('/bin/self/crime-stats.js');
                await rmi(ns)('/bin/self/crime-chance.js');
                await rmi(ns)('/bin/self/crime.js');
            }
        };

        const getStatToTrain = lvlReq => COMBAT_STATS.find(stat => player[stat] < lvlReq);

        const getFactionStat = (targetFaction) => getStatToTrain(COMBAT_REQUIREMENTS[targetFaction] || 0);

        const statForCrimeTraining = getStatToTrain(5);
        if (statForCrimeTraining != null) {
            if (player.money > 5000)
                await rmi(ns)('/bin/self/improvement.js', 1, statForCrimeTraining, 5);
            else
                await rmi(ns)('/bin/self/job.js', 1);
        } else if (isMoneyBound(ns) || isFactionGang) {
            await makeMoney();
        } else if (inTargetFaction) {
            if (rep < getRepNeeded(ns)) {
                getConfig(ns).set('share', .1);
                await rmi(ns)('/bin/self/faction-work.js', 1, targetFaction);
            } else {
                getConfig(ns).set('share', 0);
                await makeMoney();
            }
        } else {
            const statToTrain = getFactionStat(targetFaction);
            const requiredLocations = FACTION_LOCATIONS[targetFaction] || CITY_FACTIONS;
            if (statToTrain != null)
                await rmi(ns)('/bin/self/improvement.js', 1, statToTrain, COMBAT_REQUIREMENTS[targetFaction]);
            else if (!requiredLocations.includes(player.city))
                await rmi(ns)('/bin/self/travel.js', 1, requiredLocations[0]);
            else
                await makeMoney();
        }
        await ns.sleep(100);
    }
}