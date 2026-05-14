import { getPlayerData, getGoalsData } from "../../lib/data-store";
import { getGoals, timeToComplete } from "../../lib/goals";
import { rmi } from "../../lib/rmi";
import { getConfig } from "../../lib/config";

/**
 * Returns the faction with the largest remaining rep gap that the player
 * is already a member of, or null if no rep work is needed.
 * @param {ReturnType<typeof getGoals>} goals
 * @param {string[]} factions
 * @param {Record<string, number>} factionRep
 * @returns {string | null}
 */
const getWorkFaction = (goals, factions, factionRep) => {
  const gap = (/** @type {import("../../lib/goals").Goal} */ g) =>
    (g.requirement ?? 0) - (factionRep[/** @type {string} */ (g.faction)] ?? 0);
  return goals
    .filter(g => g.type === "FACTION_REP" && g.faction != null && !g.isDone() && factions.includes(/** @type {string} */ (g.faction)))
    .sort((a, b) => gap(b) - gap(a))[0]?.faction ?? null;
};

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  await rmi(ns, true)("/bin/self/apply.js");

  while (true) {
    const { targetFaction } = getGoalsData(ns);
    const { player, isPlayerActive, factionRep = {} } = getPlayerData(ns);

    const inTargetFaction = player.factions.includes(targetFaction);
    const isFactionGang =
      ns.gang.inGang() &&
      ns.gang.getGangInformation().faction === targetFaction;

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
    const memo = new Map();
    const unmetRepGoals = goals.filter(g => g.type === 'FACTION_REP' && !g.isDone());
    const isRepBound = () => {
      if (unmetRepGoals.find((goal) => timeToComplete(goal, memo) == null)) {
        return true;
      }
      const maxRepTime = unmetRepGoals.length > 0
        ? Math.max(...unmetRepGoals.map(g => timeToComplete(g, memo) ?? 0))
        : 0;
      const amg = goals.find(g => g.type === 'AUG_MONEY');
      const moneyTime = amg != null ? timeToComplete(amg, memo) : null;
      return moneyTime == null || moneyTime <= maxRepTime;
    };
    const workFaction = getWorkFaction(goals, player.factions, factionRep);
    const statForCrimeTraining = (["strength", "defense", "dexterity", "agility"])
      .find((/** @type {string} */ stat) => player.skills[/** @type {keyof Skills} */ (stat)] < 5);

    if (statForCrimeTraining != null) {
      if (player.money > 5000)
        await rmi(ns)("/bin/self/improvement.js", 1, statForCrimeTraining, 5);
      else await rmi(ns)("/bin/self/job.js", 1);
    } else if (!isRepBound() || isFactionGang) {
      await makeMoney();
    } else if (workFaction != null) {
      getConfig(ns).set("share", 0.1);
      await rmi(ns)("/bin/self/faction-work.js", 1, workFaction);
    } else if (inTargetFaction) {
      getConfig(ns).set("share", 0);
      await makeMoney();
    } else {
      const combatGoal = goals.find(g => g.type === "COMBAT_LEVELS" && !g.isDone());
      const locationGoal = goals.find(g => g.type === "LOCATION" && !g.isDone())?.requirement;
      if (combatGoal != null)
        await rmi(ns)("/bin/self/improvement.js", 1);
      else if (locationGoal)
        await rmi(ns)("/bin/self/travel.js", 1, locationGoal);
      else await makeMoney();
    }
    await ns.sleep(100);
  }
}
