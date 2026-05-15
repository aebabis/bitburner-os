import { getGoals, COMBAT_STATS } from "../../lib/goals";
import { shouldWorkHaveFocus } from "../../lib/query-service";
import { putPlayerData } from "../../lib/data-store";

/** @param {NS} ns */
export async function main(ns) {
  const combatGoal = getGoals(ns).find(g => g.type === "COMBAT_LEVELS" && !g.isDone());
  const levelReq = combatGoal?.requirement ?? 0;
  const statToTrain = COMBAT_STATS.find(s => ns.getPlayer().skills[s] < levelReq);
  if (statToTrain) {
    const focus = shouldWorkHaveFocus(ns);
    ns.singularity.gymWorkout("Powerhouse Gym", ns.enums.GymType[statToTrain], focus);
    putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
    const cutoff = Date.now() + 10000;
    while (ns.getPlayer().skills[statToTrain] < levelReq && Date.now() < cutoff) await ns.sleep(50);
  }
}
