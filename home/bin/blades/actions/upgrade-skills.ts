// https://www.reddit.com/r/Bitburner/comments/sn419a/a_guide_to_bn6bladeburner_advice_from_discord/
// Skills that boost stats and Operation/Black Op success chance are good.
// Level them all roughly equally.
// Caveat: Cloak and Short Circuit are useless against the last few Black Ops,
// so don't level them past ~25.
//
// S-TIER
// Blade's Intuition - level often
// Digital Observer - wait until doing Operations
// Reaper - level often
// Evasive System - level often
//
// A-TIER
// Cloak - not useful in end-game; limit to 25 levels
// Short Circuit - not useful in end-game; limit to 25 levels
// Overclock - wait until Assassinate chance is 90%+
//
// B-TIER
// Tracer - only good for contracts; limit to 10 levels
// Hyperdrive - only buy when stagnating; 10-20 levels
//
// C/D-TIER
// Datamancer - just do more Field Analysis instead
// Cyber's Edge - Reaper and Elusive System are supposedly better. Not sure why not both?
// Hands of Midas - Money sucks

import { getBladeData, putBladeData } from '../../../lib/data-store';

const SKILL_LIMITS: Record<BladeburnerSkillName, number> = {
  "Blade's Intuition": Infinity,
  Cloak: 25,
  'Short-Circuit': 25,
  'Digital Observer': Infinity,
  Tracer: 10,
  Overclock: Infinity,
  Reaper: Infinity,
  'Evasive System': Infinity,
  Datamancer: 0,
  "Cyber's Edge": 0,
  'Hands of Midas': 0,
  Hyperdrive: 20,
};

type SkillCondition = (ns: NS) => boolean;

const LIMITATIONS: Partial<Record<BladeburnerSkillName, SkillCondition>> = {
  'Digital Observer': (ns) => {
    const { actions } = getBladeData(ns);
    const [low, high] = actions.Operations.Investigation.estimatedChance;
    return (low + high) / 2 > 0.7;
  },
  Overclock: (ns) => {
    const { actions } = getBladeData(ns);
    const [low, high] = actions.Operations.Assassination.estimatedChance;
    return (low + high) / 2 > 0.9;
  },
};

const SKILLS = Object.keys(SKILL_LIMITS) as BladeburnerSkillName[];

export async function main(ns: NS) {
  const skills = SKILLS.map((name) => ({
    name,
    cost: ns.bladeburner.getSkillUpgradeCost(name),
    level: ns.bladeburner.getSkillLevel(name),
    limit: SKILL_LIMITS[name],
    upgradedThisTick: false,
  }));
  const neededSkills = skills
    .filter((skill) => skill.level < skill.limit)
    .filter((skill) => LIMITATIONS[skill.name]?.(ns) ?? true)
    .sort((a, b) => a.cost - b.cost);
  const upgraded = new Set<BladeburnerSkillName>();
  for (const skill of neededSkills) {
    if (ns.bladeburner.upgradeSkill(skill.name)) {
      upgraded.add(skill.name);
      skill.upgradedThisTick = true;
    }
  }
  putBladeData(ns, { skills });
}
