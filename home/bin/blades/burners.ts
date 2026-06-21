import { getGoals } from '../../lib/goals/goals';
import { inPlace } from '../../lib/in-place';
import { $sing } from '../../lib/sing.rip';
import {
  $getActions,
  $getCities,
  $getCurrentAction,
  $selectCity,
  $startAction,
  $train,
  $upgradeSkills,
  BladeAction,
  BladeActions,
} from './burners.rip';
import { openTail, showInfo } from './report';

const getNextMission =
  (ns: NS) =>
  async (
    actions: BladeActions,
    currentBlackOp: BladeburnerBlackOpName | null,
    rank: number,
  ): Promise<[BladeburnerActionType, BladeburnerActionName] | null> => {
    const canDo = (action: BladeAction, chance: number) =>
      action.actionCountRemaining >= 1 && action.estimatedChance[0] >= chance;
    const $ = inPlace(ns, ns.pid);
    if (currentBlackOp != null) {
      const blackOpRank = await $.bladeburner['getBlackOpRank'](currentBlackOp);
      if (blackOpRank < rank && canDo(actions['Black Operations'][currentBlackOp], 0.8)) {
        return ['Black Operations', currentBlackOp];
      }
    }
    const operation = ns.bladeburner
      .getOperationNames()
      .filter((opName) => opName !== 'Raid') // I herd raids r bad
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

const needsIntel = (actions: BladeActions) => {
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

export async function main(ns: NS) {
  const $ = inPlace(ns, ns.pid);
  openTail(ns);

  typeof ns.singularity.getOwnedAugmentations;

  const { ownedAugs } = await $['getResetInfo']();
  const hasBlade = ownedAugs.has("The Blade's Simulacrum");

  while (!(await $.bladeburner['joinBladeburnerDivision']())) {
    await $train(ns)();
    await ns.sleep(1000);
  }

  while (true) {
    if (!hasBlade) {
      await $sing(ns, ns.pid)(getGoals(ns));
    }

    const actions = await $getActions(ns);
    const cities = await $getCities(ns);
    const stamina = await $.bladeburner['getStamina']();
    const rank = await $.bladeburner['getRank']();
    const skills = await $upgradeSkills(ns)(actions, stamina);
    const city = await $selectCity(ns)(cities);
    const currentBlackOp = ((await $.bladeburner['getNextBlackOp']()) || {}).name || null;

    const hasStaminaPenalty = stamina[0] * 2 < stamina[1];
    if (hasStaminaPenalty) {
      if (hasBlade) {
        await $startAction(ns)('General', 'Training');
      } else {
        await $train(ns)('agility');
      }
    }
    if (cities[city].chaos > 10) {
      await $startAction(ns)('General', 'Diplomacy');
    } else {
      const mission = await getNextMission(ns)(actions, currentBlackOp, rank);
      if (mission) {
        const [type, name] = mission;
        await $startAction(ns)(type, name);
      } else if (needsIntel(actions)) {
        await $startAction(ns)('General', 'Field Analysis');
      } else if (hasBlade) {
        await $startAction(ns)('General', 'Training');
      } else {
        await $train(ns)();
      }
    }
    const currentAction = await $getCurrentAction(ns);
    showInfo(ns)(cities, skills, hasBlade, currentAction, city, currentBlackOp);
    await ns.bladeburner.nextUpdate();
  }
}
