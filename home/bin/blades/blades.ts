import { BRIGHT, NORMAL } from '../../lib/colors';
import { BladeAction, getBladeData } from '../../lib/data-store';
import { rmi } from '../../lib/rmi';

const hasBlade = (ns: NS) =>
  ns.getResetInfo().ownedAugs.has("The Blade's Simulacrum");

const start =
  (ns: NS) =>
  async (type: BladeburnerActionType, name: BladeburnerActionName) =>
    rmi(ns)('/bin/blades/actions/start-action.ts', 1, type, name);

// TODO: Support charisma
const improve = async (
  ns: NS,
  stat: 'strength' | 'defense' | 'dexterity' | 'agility',
) => {
  if (hasBlade(ns)) {
    await start(ns)('General', 'Training');
  } else {
    await rmi(ns)('/bin/self/improvement.ts', 1, stat);
  }
};

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

const hasStaminaPenalty = (ns: NS) => {
  const [currentStamina, maxStamina] = ns.bladeburner.getStamina();
  return currentStamina * 2 < maxStamina;
};

const getLowestStat = (ns: NS) => {
  const { skills } = ns.getPlayer();
  const stats = ['strength', 'defense', 'dexterity', 'agility'] as const;
  return stats.reduce((s1, s2) => (skills[s1] < skills[s2] ? s1 : s2));
};

const showInfo = (ns: NS) => {
  ns.clearLog();
  ns.print(
    BRIGHT.BOLD + '  SIMULACRUM: ' + NORMAL(hasBlade(ns) ? 'Yes' : 'No'),
  );
  // const reports = getBladeReports(ns);
  // for (const type of ['Action', 'Locations', 'Skills'] as const) {
  //   const report = reports[type];
  //   if (report) {
  //     ns.print('\n');
  //     ns.print(
  //       report
  //         .split('\n')
  //         .map((line) => ' ' + line)
  //         .join('\n'),
  //     );
  //   }
  // }
  ns.print('\n');
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();
  ns.ui.resizeTail(320, 450);

  while (!ns.bladeburner.inBladeburner()) {
    await rmi(ns)('/bin/self/travel.ts', 1, 'Sector-12');
    await rmi(ns)('/bin/self/improvement.ts', 1, getLowestStat(ns));
    await rmi(ns)('/bin/blades/actions/join-bladeburner-division.ts');
    await ns.sleep(1000);
  }

  while (true) {
    await rmi(ns)('/bin/blades/actions/upgrade-skills.ts');
    await rmi(ns)('/bin/blades/actions/travel.ts');
    await rmi(ns)('/bin/blades/actions/load-actions.ts');
    const { actions } = getBladeData(ns);
    if (hasStaminaPenalty(ns)) {
      await improve(ns, 'agility');
    } else {
      const { name } = ns.bladeburner.getNextBlackOp() || {};
      if (name && canDo(actions['Black Operations'][name], 0.8)) {
        await start(ns)('Black Operations', name);
      } else {
        const operation = ns.bladeburner
          .getOperationNames()
          .reverse()
          .find((operation) => canDo(actions['Operations'][operation], 0.7));
        if (operation) {
          await start(ns)('Operations', operation);
        } else {
          const contract = ns.bladeburner
            .getContractNames()
            .reverse()
            .find((contract) => canDo(actions['Contracts'][contract], 0.7));
          if (contract) {
            await start(ns)('Contracts', contract);
          } else {
            if (needsIntel(ns)) {
              await start(ns)('General', 'Field Analysis');
            } else {
              await improve(ns, getLowestStat(ns));
            }
          }
        }
      }
    }

    showInfo(ns);
    await ns.bladeburner.nextUpdate();
  }
}
