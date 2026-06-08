export const BN8_WEIGHTS: Record<keyof Multipliers, number> = {
  // Hacking is mostly useful for money in BN8
  hacking: 2,
  hacking_chance: 2,
  hacking_speed: 2,
  hacking_exp: 2,
  faction_rep: 1,
  hacking_money: 2,
  hacking_grow: 2,
  company_rep: 1,
  work_money: 1,

  // Bladeburner Stats
  strength: 5,
  defense: 5,
  dexterity: 5,
  agility: 5,
  charisma: 5,
  strength_exp: 2.5,
  defense_exp: 2.5,
  dexterity_exp: 2.5,
  agility_exp: 2.5,
  charisma_exp: 2.5,

  bladeburner_max_stamina: 0,
  bladeburner_stamina_gain: 0,
  bladeburner_analysis: 0,
  bladeburner_success_chance: 0,

  // Worthless
  crime_money: 0,
  crime_success: 0,
  dnet_money: 0, // Not sure about this one yet

  hacknet_node_money: 0,
  hacknet_node_purchase_cost: 0,
  hacknet_node_ram_cost: 0,
  hacknet_node_core_cost: 0,
  hacknet_node_level_cost: 0,
};
