import { getPlayerData } from "../../lib/data-store";
import { isMoneyBound, getRepNeeded, getTargetFaction } from "../../lib/query-service";
import { getGoals } from "../../lib/goals";
import { rmi } from "../../lib/rmi";
import getConfig from "../../lib/config";
import {
  CITY_FACTIONS,
  FACTION_LOCATIONS,
} from "./aug/factions";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  await rmi(ns, true)("/bin/self/apply.js");

  while (true) {
    const player = ns.getPlayer();
    const targetFaction = getTargetFaction(ns);
    const { isPlayerActive, factionRep = {} } = getPlayerData(ns);

    const inTargetFaction = player.factions.includes(targetFaction);
    const isFactionGang =
      ns.gang.inGang() &&
      ns.gang.getGangInformation().faction === targetFaction;
    const rep = factionRep[targetFaction] || 0;

    const makeMoney = async () => {
      if (isPlayerActive) {
        await rmi(ns)("/bin/self/job.js", 1);
      } else {
        await rmi(ns)("/bin/self/crime-stats.js");
        await rmi(ns)("/bin/self/crime-chance.js");
        await rmi(ns)("/bin/self/crime.js");
      }
    };

    const goals = getGoals(ns);
    const statForCrimeTraining = (["strength", "defense", "dexterity", "agility"])
      .find((/** @type {string} */ stat) => player.skills[/** @type {keyof Skills} */ (stat)] < 5);

    if (statForCrimeTraining != null) {
      if (player.money > 5000)
        await rmi(ns)("/bin/self/improvement.js", 1, statForCrimeTraining, 5);
      else await rmi(ns)("/bin/self/job.js", 1);
    } else if (isMoneyBound(ns) || isFactionGang) {
      await makeMoney();
    } else if (inTargetFaction) {
      if (rep < (getRepNeeded(ns) ?? 0)) {
        getConfig(ns).set("share", 0.1);
        await rmi(ns)("/bin/self/faction-work.js", 1, targetFaction);
      } else {
        getConfig(ns).set("share", 0);
        await makeMoney();
      }
    } else {
      const combatGoal = goals.find(g => g.type === "COMBAT_LEVELS" && !g.isDone());
      const requiredLocations =
        (/** @type {Record<string, string[]>} */ (FACTION_LOCATIONS))[targetFaction] || CITY_FACTIONS;
      if (combatGoal != null)
        await rmi(ns)("/bin/self/improvement.js", 1);
      else if (!requiredLocations.includes(player.city))
        await rmi(ns)("/bin/self/travel.js", 1, requiredLocations[0]);
      else await makeMoney();
    }
    await ns.sleep(100);
  }
}
