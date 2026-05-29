import { getGoals } from '../../lib/goals/goals';
import { shouldWorkHaveFocus } from '../../lib/query-service';
import { putPlayerData } from '../../lib/data-store';

const COMBAT_STATS = /** @type {(keyof GymEnumType)[]} */ [
  'strength',
  'defense',
  'dexterity',
  'agility',
];

const getStatToTrain = (ns: NS, levelReq: number) => {
  const { skills } = ns.getPlayer();
  const possibleStats = COMBAT_STATS.filter((stat) => levelReq > skills[stat]);
  let stat = possibleStats[0];
  for (const other of possibleStats) {
    if (skills[other] < skills[stat]) stat = other;
  }
  return stat;
};

const getTargetLevel = (ns: NS) => {
  if (ns.args.length > 0) {
    const stat = /** @type {keyof GymEnumType} */ ns.args[0];
    const level = ns.args[1];
    if (!COMBAT_STATS.includes(stat)) {
      throw new Error(
        `First param, if given, must be a combat stat (${COMBAT_STATS})`,
      );
    }
    if (typeof level !== 'number') {
      throw new Error('Second param must be a number');
    }
    return { stat, level };
  } else {
    const combatGoal = getGoals(ns).find(
      (g) => g.type === 'COMBAT_LEVELS' && !g.isDone(),
    );
    if (combatGoal == null) {
      console.log('No goal present on arrival at gym');
    }
    const level = combatGoal?.requirement ?? 0;
    const stat = getStatToTrain(ns, level);
    return { stat, level };
  }
};

export async function main(ns: NS) {
  const { stat, level } = getTargetLevel(ns);
  if (stat) {
    const focus = shouldWorkHaveFocus(ns);
    ns.singularity.gymWorkout('Powerhouse Gym', ns.enums.GymType[stat], focus);
    putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
    const cutoff = Date.now() + 10000;
    while (ns.getPlayer().skills[stat] < level && Date.now() < cutoff)
      await ns.sleep(50);
  }
}
