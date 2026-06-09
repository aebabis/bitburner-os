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

import { C, NORMAL } from '../../../lib/colors';
import { putBladeReports } from '../../../lib/data-store';
import { table } from '../../../lib/table';
import { by } from '../../../lib/util';

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
    const [low, high] = ns.bladeburner.getActionEstimatedSuccessChance(
      'Operations',
      'Investigation',
    );
    return (low + high) / 2 > 0.7;
  },
  Overclock: (ns) => {
    const [low, high] = ns.bladeburner.getActionEstimatedSuccessChance(
      'Operations',
      'Assassination',
    );
    return (low + high) / 2 > 0.9;
  },
};

const SKILLS = Object.keys(SKILL_LIMITS) as BladeburnerSkillName[];

export async function main(ns: NS) {
  const neededSkills = SKILLS.filter(
    (skill) => ns.bladeburner.getSkillLevel(skill) < SKILL_LIMITS[skill],
  )
    .filter((skill) => LIMITATIONS[skill]?.(ns) ?? true)
    .sort(
      (a, b) =>
        ns.bladeburner.getSkillUpgradeCost(a) -
        ns.bladeburner.getSkillUpgradeCost(b),
    );
  const upgraded = new Set<BladeburnerSkillName>();
  for (const skill of neededSkills) {
    if (ns.bladeburner.upgradeSkill(skill)) {
      upgraded.add(skill);
    }
  }

  const format = (upgraded: boolean) => (upgraded ? C(40) : NORMAL);

  const getSkill = (skill: BladeburnerSkillName) =>
    ns.bladeburner.getSkillLevel(skill);
  const columns = [
    'SKILL',
    { name: '  COST', align: 'right' },
    { name: ' LEVEL', align: 'right' },
  ];
  const rows = (
    Object.entries(SKILL_LIMITS) as [BladeburnerSkillName, number][]
  )
    .filter(([, limit]) => limit > 0)
    .sort(by(([, limit]) => limit))
    .map(([skill, limit]) => [
      format(upgraded.has(skill))(skill),
      format(upgraded.has(skill))(
        ns.format.number(ns.bladeburner.getSkillUpgradeCost(skill), 0),
      ),
      format(upgraded.has(skill))(
        getSkill(skill) + '/' + ns.format.number(limit, 0),
      ),
    ]);
  putBladeReports(ns, { Skills: table(ns, columns, rows, { colors: true }) });
}
