import { getPlayerData } from '../../lib/data-store';
import { getGoals, isRepBound } from '../../lib/goals/goals';
import { rmi } from '../../lib/rmi';
import { getConfig } from '../../lib/config';
import { Goal } from '../../lib/goals/nodes';

/**
 * Returns the faction with the largest remaining rep gap that the player
 * is already a member of, or null if no rep work is needed.
 */
const getWorkFaction = (
  goals: Goal[],
  factions: FactionName[],
  factionRep: Record<FactionName, number>,
) => {
  const gap = (g: Goal) => (g.requirement ?? 0) - (factionRep[g.faction] ?? 0);
  return (
    goals
      .filter((g) => !g.isDone())
      .filter((g) => g.type === 'FACTION_REP' || g.type === 'FACTION_FAVOR')
      .filter((g) => g.faction && factions.includes(g.faction))
      .sort((a, b) => gap(b) - gap(a))[0]?.faction ?? null
  );
};

export async function main(ns: NS) {
  ns.disableLog('ALL');

  await rmi(ns, true)('/bin/self/apply.ts');

  while (true) {
    const { player, isPlayerActive, factionRep = {} } = getPlayerData(ns);

    const statForCrimeTraining = [
      'strength',
      'defense',
      'dexterity',
      'agility',
    ].find((stat) => player.skills[stat] < 5);

    const makeMoney = async () => {
      if (isPlayerActive) {
        await rmi(ns)('/bin/self/job.ts', 1);
      } else if (statForCrimeTraining != null) {
        if (player.money > 5000)
          await rmi(ns)('/bin/self/improvement.ts', 1, statForCrimeTraining, 5);
        else await rmi(ns)('/bin/self/job.ts', 1);
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
    const hackLevelGoal =
      goals.find((goal) => goal.type === 'HACKING_LEVEL')?.requirement ?? 0;
    const hackXpGoal =
      goals.find((goal) => goal.type === 'HACKING_XP')?.requirement ?? 0;
    const killsGoal = goals.find((goal) => goal.type === 'KILLS');
    getConfig(ns).set('share', 0);

    if (hackXpGoal) {
      await rmi(ns)('/bin/self/school.ts', 1);
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
        const { skills } = ns.getPlayer();
        const lowestStat = (
          ['strength', 'defense', 'dexterity', 'agility'] as const
        ).reduce((s1, s2) => (skills[s1] < skills[s2] ? s1 : s2));
        await rmi(ns)('/bin/self/travel.ts', 1, 'Sector-12');
        await rmi(ns)('/bin/self/improvement.ts', 1, lowestStat);
      } else if (locationGoal) {
        await rmi(ns)('/bin/self/travel.ts', 1, locationGoal);
      } else if (killsGoal) {
        await rmi(ns)('/bin/self/crime.ts');
      } else {
        await makeMoney();
      }
    }
    await ns.sleep(200);
  }
}
