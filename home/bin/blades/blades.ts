import { rmi } from '../../lib/rmi';

const startAction =
  (ns: NS) => (type: BladeburnerActionType, name: BladeburnerActionName) => {
    const current = ns.bladeburner.getCurrentAction();
    if (current == null || current.type !== type || current.name !== name) {
      ns.bladeburner.startAction(type, name);
    }
  };

const tryAction =
  (ns: NS) =>
  (
    type: BladeburnerActionType,
    name: BladeburnerActionName,
    chance: number,
  ) => {
    const [lower] = ns.bladeburner.getActionEstimatedSuccessChance(type, name);
    if (lower < chance) return false;
    startAction(ns)(type, name);
    return true;
  };

export async function main(ns: NS) {
  ns.disableLog('ALL');

  await rmi(ns, true)('/bin/self/apply.ts');

  while (true) {
    const { skills } = ns.getPlayer();

    const lowestStat = (
      ['strength', 'defense', 'dexterity', 'agility'] as const
    ).reduce((s1, s2) => (skills[s1] < skills[s2] ? s1 : s2));

    if (!ns.bladeburner.inBladeburner()) {
      await rmi(ns)('/bin/self/travel.ts', 1, 'Sector-12');
      await rmi(ns)('/bin/self/improvement.ts', 1, lowestStat);
      await rmi(ns)('/bin/blades/actions/join-bladeburner-division.ts');
    } else {
      const [currentStamina, maxStamina] = ns.bladeburner.getStamina();
      if (currentStamina * 2 < maxStamina) {
        await rmi(ns)('/bin/self/improvement.ts', 1, 'agility');
      } else {
        if (
          !(
            tryAction(ns)('Contracts', 'Tracking', 0.7) ||
            tryAction(ns)('Contracts', 'Bounty Hunter', 0.7) ||
            tryAction(ns)('Contracts', 'Retirement', 0.7)
          )
        ) {
          await rmi(ns)('/bin/self/improvement.ts', 1, lowestStat);
        }
      }
    }
    await rmi(ns)('/bin/blades/actions/upgrade-skills.ts');

    await ns.bladeburner.nextUpdate();
  }
}
