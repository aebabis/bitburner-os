import { getGoals, COMBAT_STATS } from "../../lib/goals";
import { shouldWorkHaveFocus } from "../../lib/query-service";
import { putPlayerData } from "../../lib/data-store";
import { by } from "../../lib/util";

/** @param {NS} ns */
export async function main(ns) {
  const combatGoal = getGoals(ns).find(g => g.type === "COMBAT_LEVELS" && !g.isDone());
  const levelReq = combatGoal?.requirement ?? 0;
  const levelsNeeded = COMBAT_STATS.map((stat) => [stat, levelReq - ns.getPlayer().skills[stat]])
    .filter(([, needed]) => +needed > 0)
    .sort(by('1'));
  const statToTrain = levelsNeeded.at(-1)?.[0];
  if (statToTrain) {
    const focus = shouldWorkHaveFocus(ns);
    ns.singularity.gymWorkout("Powerhouse Gym", ns.enums.GymType[statToTrain], focus);
    putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
    const cutoff = Date.now() + 10000;
    while (ns.getPlayer().skills[statToTrain] < levelReq && Date.now() < cutoff) await ns.sleep(50);
  }
}
