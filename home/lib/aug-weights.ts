export const getAugWeights = (resetInfo: ResetInfo) => {
  const onBN = (num: number) => resetInfo.currentNode === num;
  const hasSF = (sf: number, level = 1) => (resetInfo.ownedSF.get(sf) ?? 0) >= level;
  const onBB = onBN(6) || onBN(7);
  return {
    hacking: onBB ? 2 : 5,
    hacking_chance: onBB ? 2 : 5,
    hacking_speed: onBB ? 2 : 5,
    hacking_exp: onBB ? 2 : 5,

    faction_rep: onBB ? 1 : 10,

    hacking_money: 2,
    hacking_grow: 2,
    company_rep: 1,
    work_money: 1,
    crime_money: 0,
    crime_success: 0,
    dnet_money: onBN(15) ? 1 : hasSF(15) ? 0.1 : 0,

    strength: onBB ? 5 : 1,
    defense: onBB ? 5 : 1,
    dexterity: onBB ? 5 : 1,
    agility: onBB ? 5 : 1,
    strength_exp: onBB ? 2.5 : 0.5,
    defense_exp: onBB ? 2.5 : 0.5,
    dexterity_exp: onBB ? 2.5 : 0.5,
    agility_exp: onBB ? 2.5 : 0.5,
    charisma: onBN(15) ? 20 : hasSF(15) ? 1 : 0,
    charisma_exp: onBN(15) ? 20 : hasSF(15) ? 1 : 0,

    hacknet_node_money: onBN(9) ? 5 : hasSF(9) ? 1 : 0,
    hacknet_node_purchase_cost: onBN(9) ? 5 : hasSF(9) ? 1 : 0,
    hacknet_node_ram_cost: onBN(9) ? 5 : hasSF(9) ? 1 : 0,
    hacknet_node_core_cost: onBN(9) ? 5 : hasSF(9) ? 1 : 0,
    hacknet_node_level_cost: onBN(9) ? 5 : hasSF(9) ? 1 : 0,

    bladeburner_max_stamina: onBB ? 5 : hasSF(7, 3) ? 1 : 0,
    bladeburner_stamina_gain: onBB ? 5 : hasSF(7, 3) ? 1 : 0,
    bladeburner_analysis: onBB ? 5 : hasSF(7, 3) ? 1 : 0,
    bladeburner_success_chance: onBB ? 5 : hasSF(7, 3) ? 1 : 0,
  };
};

export type AugWeights = ReturnType<typeof getAugWeights>;
