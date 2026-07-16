import { StaticData } from '../data-store';
import { augMultiplier } from '../formulas';

const NEUTRAL_MULTS: Multipliers = {
  hacking: 1,
  strength: 1,
  defense: 1,
  dexterity: 1,
  agility: 1,
  charisma: 1,
  hacking_exp: 1,
  strength_exp: 1,
  defense_exp: 1,
  dexterity_exp: 1,
  agility_exp: 1,
  charisma_exp: 1,
  hacking_chance: 1,
  hacking_speed: 1,
  hacking_money: 1,
  hacking_grow: 1,
  company_rep: 1,
  faction_rep: 1,
  crime_money: 1,
  crime_success: 1,
  dnet_money: 1,
  work_money: 1,
  hacknet_node_money: 1,
  hacknet_node_purchase_cost: 1,
  hacknet_node_ram_cost: 1,
  hacknet_node_core_cost: 1,
  hacknet_node_level_cost: 1,
  bladeburner_max_stamina: 1,
  bladeburner_stamina_gain: 1,
  bladeburner_analysis: 1,
  bladeburner_success_chance: 1,
};

const DEFAULT_SKILLS: Skills = {
  hacking: 1,
  strength: 1,
  defense: 1,
  dexterity: 1,
  agility: 1,
  charisma: 1,
  intelligence: 1,
};

// Multipliers from the product of a set of augmentations' stats (defaults to installed augs;
// pass a hypothetical set to simulate a different augmentation state).
export const buildMults = (
  staticData: StaticData,
  augs: string[] = staticData.installedAugmentations ?? [],
): Multipliers =>
  Object.fromEntries(
    (Object.keys(NEUTRAL_MULTS) as (keyof Multipliers)[]).map((stat) => [
      stat,
      augMultiplier(staticData, stat, augs),
    ]),
  ) as unknown as Multipliers;

// A fixture Person for ns.formulas calls, which require hp/exp/mults/city to be present.
export const buildPerson = (
  staticData: StaticData,
  overrides: Partial<Person> & { augs?: string[] } = {},
): Person => {
  const { augs, ...personOverrides } = overrides;
  return {
    hp: { current: 100, max: 100 },
    skills: DEFAULT_SKILLS,
    exp: {
      hacking: 0,
      strength: 0,
      defense: 0,
      dexterity: 0,
      agility: 0,
      charisma: 0,
      intelligence: 0,
    },
    mults: buildMults(staticData, augs),
    city: 'Sector-12' as CityName,
    ...personOverrides,
  };
};
