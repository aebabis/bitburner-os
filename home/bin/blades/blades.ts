import { rmi } from '../../lib/rmi';

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
    await rmi(ns)('/bin/blades/actions/start-action.ts', 1, type, name);
    return true;
  };

const findContract = async (ns: NS) => {
  const contractNames = ns.bladeburner.getContractNames();
  for (const name of contractNames) {
    if (await tryAction(ns)('Contracts', name, 0.7)) return true;
  }
  return false;
};

const needsIntel = (ns: NS) =>
  ns.bladeburner.getContractNames().some((contract) => {
    const [lower, upper] = ns.bladeburner.getActionEstimatedSuccessChance(
      'Contracts',
      contract,
    );
    return upper - lower > 0.1;
  });

const getLowestStat = (ns: NS) => {
  const { skills } = ns.getPlayer();
  const stats = ['strength', 'defense', 'dexterity', 'agility'] as const;
  return stats.reduce((s1, s2) => (skills[s1] < skills[s2] ? s1 : s2));
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.ui.openTail();

  await rmi(ns, true)('/bin/self/apply.ts');

  while (true) {
    if (!ns.bladeburner.inBladeburner()) {
      await rmi(ns)('/bin/self/travel.ts', 1, 'Sector-12');
      await rmi(ns)('/bin/self/improvement.ts', 1, getLowestStat(ns));
      await rmi(ns)('/bin/blades/actions/join-bladeburner-division.ts');
      await ns.bladeburner.nextUpdate();
      continue;
    }

    await rmi(ns)('/bin/blades/actions/travel.ts');
    const [currentStamina, maxStamina] = ns.bladeburner.getStamina();
    if (currentStamina * 2 < maxStamina) {
      await rmi(ns)('/bin/self/improvement.ts', 1, 'agility');
    } else {
      if (!(await findContract(ns))) {
        if (needsIntel(ns)) {
          await rmi(ns)(
            '/bin/blades/actions/start-action.ts',
            1,
            'General',
            'Field Analysis',
          );
        } else {
          await rmi(ns)('/bin/self/improvement.ts', 1, getLowestStat(ns));
        }
      }
    }
    await rmi(ns)('/bin/blades/actions/upgrade-skills.ts');

    await ns.bladeburner.nextUpdate();
  }
}
