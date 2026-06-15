import { BladeAction, getBladeData } from '../../../lib/data-store';
import { joinSpawnChain } from '../../../lib/service-api';
import { rmi } from '../../../lib/rmi';

const hasBlade = (ns: NS) => ns.getResetInfo().ownedAugs.has("The Blade's Simulacrum");

const canDo = (action: BladeAction, chance: number) =>
  action.actionCountRemaining >= 1 && action.estimatedChance[0] >= chance;

/**
 * Determines whether there's a viable mission that needs training
 * To be viable, the average success chance needs to be above .7
 * To need training, the probability spread needs to be above .1
 */
const needsIntel = (ns: NS) => {
  const { actions } = getBladeData(ns);
  const missions = [
    ...Object.values(actions.Contracts),
    ...Object.values(actions.Operations),
    ...Object.values(actions['Black Operations']),
  ];
  return missions.some((mission) => {
    const [lower, upper] = mission.estimatedChance;
    const avg = (lower + upper) / 2;
    return avg > 0.7 && upper - lower > 0.1;
  });
};

const getNextMission = (ns: NS): [BladeburnerActionType, BladeburnerActionName] | null => {
  const { actions } = getBladeData(ns);
  const { name } = ns.bladeburner.getNextBlackOp() || {};
  if (
    name &&
    ns.bladeburner.getBlackOpRank(name) <= ns.bladeburner.getRank() &&
    canDo(actions['Black Operations'][name], 0.8)
  ) {
    return ['Black Operations', name];
  }
  const operation = ns.bladeburner
    .getOperationNames()
    .reverse()
    .find((operation) => canDo(actions['Operations'][operation], 0.7));
  if (operation) {
    return ['Operations', operation];
  }
  const contract = ns.bladeburner
    .getContractNames()
    .reverse()
    .find((contract) => canDo(actions['Contracts'][contract], 0.7));
  if (contract) {
    return ['Contracts', contract];
  }
  return null;
};

export async function main(ns: NS) {
  const { linkTo } = joinSpawnChain(ns, '/bin/blades/blades.ts');
  const mission = getNextMission(ns);
  if (ns.bladeburner.getNextBlackOp() == null) {
    await rmi(ns)('/bin/self/actualize.ts', 1, 6, 'start.ts');
  }
  if (mission) {
    const [type, name] = mission;
    await linkTo('/bin/blades/actions/start-action.ts', 0, type, name);
  } else if (needsIntel(ns)) {
    await linkTo('/bin/blades/actions/start-action.ts', 0, 'General', 'Field Analysis');
  } else if (hasBlade(ns)) {
    await linkTo('/bin/blades/actions/start-action.ts', 0, 'General', 'Training');
  } else {
    await linkTo('/bin/blades/actions/gym-workout.ts');
  }
}
