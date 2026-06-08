import { rmi } from '../../lib/rmi';

const ACTION_NAMES = {
  General: (ns: NS) => ns.bladeburner.getGeneralActionNames(),
  Contracts: (ns: NS) => ns.bladeburner.getContractNames(),
  Operations: (ns: NS) => ns.bladeburner.getOperationNames(),
  'Black Operations': (ns: NS) => ns.bladeburner.getBlackOpNames(),
} as Record<BladeburnerActionType, (ns: NS) => BladeburnerActionName[]>;

const getActionNames = (ns: NS, type: BladeburnerActionType) =>
  ACTION_NAMES[type](ns);

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

const tryAction =
  (ns: NS) =>
  async (
    type: BladeburnerActionType,
    name: BladeburnerActionName,
    chance: number,
  ) => {
    if (ns.bladeburner.getActionCountRemaining(type, name) < 1) return false;
    const [lower] = ns.bladeburner.getActionEstimatedSuccessChance(type, name);
    if (lower < chance) return false;
    await start(ns)(type, name);
    return true;
  };

const findAction = async (ns: NS, type: BladeburnerActionType) => {
  for (const name of getActionNames(ns, type)) {
    if (await tryAction(ns)(type, name, 0.7)) return true;
  }
  return false;
};

/**
 * Determines if a viable action needs training.
 * To be viable, the average success chance needs to be above .7
 * To need training, the probability spread needs to be above .1
 */
const needsIntel = (ns: NS, type: BladeburnerActionType) =>
  getActionNames(ns, type).some((contract) => {
    const [lower, upper] = ns.bladeburner.getActionEstimatedSuccessChance(
      type,
      contract,
    );
    const avg = (lower + upper) / 2;
    return avg > 0.7 && upper - lower > 0.1;
  });

const getLowestStat = (ns: NS) => {
  const { skills } = ns.getPlayer();
  const stats = ['strength', 'defense', 'dexterity', 'agility'] as const;
  return stats.reduce((s1, s2) => (skills[s1] < skills[s2] ? s1 : s2));
};

const showInfo = (ns: NS) => {
  ns.clearLog();
  ns.print('Simulacrum: ' + hasBlade(ns));
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();

  while (!ns.bladeburner.inBladeburner()) {
    await rmi(ns)('/bin/self/travel.ts', 1, 'Sector-12');
    await rmi(ns)('/bin/self/improvement.ts', 1, getLowestStat(ns));
    await rmi(ns)('/bin/blades/actions/join-bladeburner-division.ts');
    await ns.bladeburner.nextUpdate();
  }

  while (true) {
    await rmi(ns)('/bin/blades/actions/upgrade-skills.ts');
    await rmi(ns)('/bin/blades/actions/travel.ts');
    const [currentStamina, maxStamina] = ns.bladeburner.getStamina();
    if (currentStamina * 2 < maxStamina) {
      await improve(ns, 'agility');
    } else {
      const missionTypes = [
        'Black Operations',
        'Operations',
        'Contracts',
      ] as const;
      let foundAction;
      for (const type of missionTypes) {
        if ((foundAction = await findAction(ns, type))) break;
      }
      if (!foundAction) {
        const trainingType = missionTypes.find((type) => needsIntel(ns, type));
        if (trainingType) {
          await start(ns)('General', 'Field Analysis');
        } else {
          await improve(ns, getLowestStat(ns));
        }
      }
    }

    showInfo(ns);
    await ns.bladeburner.nextUpdate();
  }
}
