/** @type {Record<keyof Multipliers, number>} */
export const DEFAULT_AUG_WEIGHTS = {
  // High — hacking effectiveness
  hacking:        10,
  hacking_money:  10,
  hacking_chance:  8,
  hacking_speed:   8,
  hacking_grow:    8,
  hacking_exp:     4,

  // Low-medium — rep/income acceleration
  faction_rep:  3,
  company_rep:  2,
  work_money:   2,

  // Low — combat stats
  strength:      1,
  defense:       1,
  dexterity:     1,
  agility:       1,
  strength_exp:  0.5,
  defense_exp:   0.5,
  dexterity_exp: 0.5,
  agility_exp:   0.5,

  // Low — hacknet (cost stats use negative weights: lower value = better)
  hacknet_node_money:         1,
  hacknet_node_purchase_cost: -0.5,
  hacknet_node_ram_cost:      -0.5,
  hacknet_node_core_cost:     -0.5,
  hacknet_node_level_cost:    -0.5,

  // Zero — not relevant for automated play
  charisma:                  0,
  charisma_exp:              0,
  crime_money:               0,
  crime_success:             0,
  dnet_money:                0,
  bladeburner_max_stamina:   0,
  bladeburner_stamina_gain:  0,
  bladeburner_analysis:      0,
  bladeburner_success_chance: 0,
};

/**
 * @param {Multipliers} stats
 * @param {Record<keyof Multipliers, number>} weights
 * @returns {number}
 */
export const scoreAug = (stats, weights) => {
  let sum = 0;
  for (const key of /** @type {(keyof Multipliers)[]} */ (Object.keys(weights)))
    sum += ((stats[key] ?? 1) - 1) * weights[key];
  return sum;
};

/**
 * @param {number} price
 * @param {number} repReq
 * @param {number} moneyPerRep
 * @returns {number}
 */
export const augEffectiveCost = (price, repReq, moneyPerRep) =>
  Math.max(price / moneyPerRep, repReq);
