import { getPlayerData } from '../../lib/data-store';
import { getGoals, isRepBound } from '../../lib/goals/goals';
import { rmi } from '../../lib/rmi';
import { getConfig } from '../../lib/config';

/**
 * Returns the faction with the largest remaining rep gap that the player
 * is already a member of, or null if no rep work is needed.
 * @param {ReturnType<typeof getGoals>} goals
 * @param {string[]} factions
 * @param {Record<string, number>} factionRep
 * @returns {string | null}
 */
const getWorkFaction = (goals, factions, factionRep) => {
  const gap = (/** @type {import("../../lib/goals/nodes").Goal} */ g) =>
    (g.requirement ?? 0) - (factionRep[/** @type {string} */ g.faction] ?? 0);
  return (
    goals
      .filter((g) => !g.isDone())
      .filter((g) => g.type === 'FACTION_REP' || g.type === 'FACTION_FAVOR')
      .filter((g) => g.faction && factions.includes(g.faction))
      .sort((a, b) => gap(b) - gap(a))[0]?.faction ?? null
  );
};

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');

  await rmi(ns, true)('/bin/self/apply.ts');

  while (true) {
    const { player, isPlayerActive, factionRep = {} } = getPlayerData(ns);

    const makeMoney = async () => {
      if (isPlayerActive) {
        await rmi(ns)('/bin/self/job.ts', 1);
      } else {
        await rmi(ns)('/bin/self/crime-stats.ts');
        await rmi(ns)('/bin/self/crime-chance.ts');
        await rmi(ns)('/bin/self/crime.ts', 1, 30);
      }
    };
    // TODO: Make all rmi programs used here not sleep.
    // Make work, faction, and gym tasks record expected time to finish
    // (and possibly a calculated utility)
    // so cancellation can be determined here.
    // This is possible because crimes no longer require explicit
    // restarting when done.

    const goals = getGoals(ns);
    const workFaction = getWorkFaction(goals, player.factions, factionRep);
    const statForCrimeTraining = [
      'strength',
      'defense',
      'dexterity',
      'agility',
    ].find(
      (/** @type {string} */ stat) =>
        player.skills[/** @type {keyof Skills} */ stat] < 5,
    );
    const hackLevelGoal =
      goals.find((goal) => goal.type === 'HACKING_LEVEL')?.requirement ?? 0;
    const killsGoal = goals.find((goal) => goal.type === 'KILLS');
    getConfig(ns).set('share', 0);

    if (statForCrimeTraining != null) {
      if (player.money > 5000)
        await rmi(ns)('/bin/self/improvement.ts', 1, statForCrimeTraining, 5);
      else await rmi(ns)('/bin/self/job.ts', 1);
    } else if (player.money < 0) {
      await makeMoney();
    } else if (player.skills.hacking < hackLevelGoal) {
      await rmi(ns)('/bin/self/travel.ts', 1, 'Sector-12');
      await rmi(ns)('/bin/self/school.ts', 1);
    } else if (killsGoal && !killsGoal.isDone()) {
      await rmi(ns)('/bin/self/crime.ts', 1, 'Homicide');
    } else if (!isRepBound(ns, goals)) {
      await makeMoney();
    } else if (workFaction != null) {
      getConfig(ns).set('share', 0.1);
      await rmi(ns)('/bin/self/faction-work.ts', 1, workFaction);
    } else {
      const combatGoal = goals.find(
        (g) => g.type === 'COMBAT_LEVELS' && !g.isDone(),
      );
      const locationGoal = goals.find(
        (g) => g.type === 'LOCATION' && !g.isDone(),
      )?.requirement;
      ns.print(locationGoal);
      const killsGoal = goals.find(
        (g) => g.type === 'KILLS' && !g.isDone(),
      )?.requirement;
      if (combatGoal != null) {
        await rmi(ns)('/bin/self/travel.ts', 1, 'Sector-12');
        await rmi(ns)('/bin/self/improvement.ts', 1);
      } else if (locationGoal) {
        await rmi(ns)('/bin/self/travel.ts', 1, locationGoal);
      } else if (killsGoal) {
        await rmi(ns)('/bin/self/crime.ts');
      } else {
        await makeMoney();
      }
    }
    await ns.sleep(100);
  }
}
