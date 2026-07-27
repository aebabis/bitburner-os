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

/** Multipliers where lower is better. `calculateEntropy` divides these rather than multiplying. */
const COST_MULTS = new Set<keyof Multipliers>([
  'hacknet_node_purchase_cost',
  'hacknet_node_ram_cost',
  'hacknet_node_core_cost',
  'hacknet_node_level_cost',
]);

// Aug stats are multiplicative, so value is logarithmic: two +20% augs give 1.44x, not 1.4x.
// Direction is explicit per stat rather than taken as abs(): augs only ever push cost multipliers
// below 1.0, but entropy pushes them above it, and abs() would score that as a gain.
export const scoreAug = (stats: Multipliers, weights: Record<keyof Multipliers, number>) =>
  Object.entries(stats)
    .map(([key, stat = 1]) => {
      const direction = COST_MULTS.has(key as keyof Multipliers) ? -1 : 1;
      return direction * Math.log(stat) * weights[key as keyof Multipliers];
    })
    .reduce((a, b) => a + b, 0);

export const VIOLET = 'violet Congruity Implant';

/** Per-entropy-point multiplier the game applies to every entry of `player.mults`. */
export const ENTROPY_EFFECT = 0.98;

export const sumWeights = (weights: AugWeights) =>
  Object.values(weights).reduce((a, b) => a + b, 0);

export const getAugWeightTotal = (resetInfo: ResetInfo) => sumWeights(getAugWeights(resetInfo));

/**
 * Utility cost of one entropy point, in the same units `scoreAug` returns.
 *
 * Entropy scales the whole multiplier vector, so its cost is a property of the player rather
 * than of any aug: `Σ w·ln(0.98)` over every weighted stat. Scale cancels against aug values,
 * so the weights' absolute magnitude does not matter here — only their ratios.
 */
export const entropyCostOf = (weights: AugWeights) =>
  -Math.log(ENTROPY_EFFECT) * sumWeights(weights);

export const getEntropyCost = (resetInfo: ResetInfo) => entropyCostOf(getAugWeights(resetInfo));

/**
 * Augs whose multipliers are all 1.0, so `scoreAug` scores them zero and their worth has to be
 * asserted. Values are fractions of the weight table's total, not absolute numbers, so they keep
 * constant standing against stat augs as the weights change between BitNodes.
 */
const STATLESS_FRACTIONS: Record<string, number> = {
  'CashRoot Starter Kit': 0.001,
  'Neuroreceptor Management Implant': 0.024,
  'The Red Pill': 0.24,
};

/**
 * Value of an aug that carries no multipliers, or null if it is scored from its stats instead.
 *
 * Violet is the one case whose value genuinely derives from entropy rather than merely being
 * denominated in it: grafting it recovers whatever entropy has accumulated.
 */
export const statlessAugValue = (aug: string, weights: AugWeights, entropy = 0) => {
  if (aug === VIOLET) return entropyCostOf(weights) * entropy;
  const fraction = STATLESS_FRACTIONS[aug];
  return fraction == null ? null : fraction * sumWeights(weights);
};

/**
 * Total utility of the player's current multipliers, on the same scale as `scoreAug`.
 *
 * `player.mults` already has entropy folded in, so this is the realized counterpart to a
 * predicted graft value: measuring it before and after a graft yields the aug's gain net of
 * the entropy it cost. Not equal to the sum of `scoreAug` over owned augs — augs valued by
 * the hard-coded cases below contribute no multipliers — so compare deltas, not levels.
 */
export const getPlayerUtility = (resetInfo: ResetInfo, mults: Multipliers) =>
  scoreAug(mults, getAugWeights(resetInfo));

/**
 * @param entropy Current entropy, used to price violet Congruity — the only aug whose value
 *   depends on player state, since it recovers whatever entropy has accumulated.
 */
export const getAugEvaluator = (
  resetInfo: ResetInfo,
  augmentationStats: Record<string, Multipliers>,
  entropy = 0,
) => {
  if (augmentationStats == null) return null;
  const augWeights = getAugWeights(resetInfo);

  return (aug: string) =>
    statlessAugValue(aug, augWeights, entropy) ?? scoreAug(augmentationStats[aug], augWeights);
};
