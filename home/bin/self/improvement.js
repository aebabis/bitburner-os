import { getGoals, COMBAT_STATS } from "../../lib/goals";
import { shouldWorkHaveFocus } from "../../lib/query-service";
import { putPlayerData } from "../../lib/data-store";

/** @param {NS} ns @param {number} levelReq */
const getStatToTrain = (ns, levelReq) => {
  const { skills } = ns.getPlayer();
  const possibleStats = COMBAT_STATS.filter((stat) => levelReq > skills[stat]);
  let stat = possibleStats[0];
  for (const other of possibleStats) {
    if (skills[other] < skills[stat])
      stat = other;
  }
  return stat;
};

/** @param {NS} ns */
export async function main(ns) {
  const combatGoal = getGoals(ns).find(g => g.type === "COMBAT_LEVELS" && !g.isDone());
  const levelReq = combatGoal?.requirement ?? 0;
  const statToTrain = getStatToTrain(ns, levelReq);
  if (statToTrain) {
    const focus = shouldWorkHaveFocus(ns);
    ns.singularity.gymWorkout("Powerhouse Gym", ns.enums.GymType[statToTrain], focus);
    putPlayerData(ns, { currentWork: ns.singularity.getCurrentWork() });
    const cutoff = Date.now() + 10000;
    while (ns.getPlayer().skills[statToTrain] < levelReq && Date.now() < cutoff) await ns.sleep(50);
  }
}
