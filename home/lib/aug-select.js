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
  hacknet_node_purchase_cost: .5,
  hacknet_node_ram_cost:      .5,
  hacknet_node_core_cost:     .5,
  hacknet_node_level_cost:    .5,

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
export const scoreAug = (stats, weights) => Object.entries(stats)
  .map(([key, stat = 1]) => {
    const mult = stat >= 1 ? stat : (1 / stat);
    return (mult - 1) * weights[key];
  })
  .reduce((a, b) => a+b, 0);

/**
 * @param {number} [factionWorkRepGain] - BitNodeMultipliers.FactionWorkRepGain; defaults to 1
 * @returns {number}
 */
export const getMoneyPerRep = (factionWorkRepGain = 1) => 4000 / factionWorkRepGain;

/**
 * @param {number} price
 * @param {number} repReq
 * @param {number} moneyPerRep
 * @returns {number}
 */
export const augEffectiveCost = (price, repReq, moneyPerRep) =>
  Math.max(price / moneyPerRep, repReq);

// Seconds of reset overhead modeled for the first aug run; decreases as more augs are installed.
const OVERHEAD_BASE = 120 * 60;

import { STORY_FACTIONS, CITY_FACTIONS } from "./factions.js";

/**
 * @param {string[]} ownedAugmentations
 * @param {{
 *   augmentationPrices: Record<string,number>,
 *   augmentationRepReqs: Record<string,number>,
 *   augmentationPrereqs: Record<string,string[]>,
 *   augmentationStats?: Record<string,Multipliers>,
 *   factionAugmentations: Record<string,string[]>,
 *   factionRequirements?: Record<string,any[]>,
 *   ownedAugmentations?: string[],
 * }} staticData
 * @param {string | undefined} cityFaction
 * @param {Record<string, number>} [factionRep]
 * @param {{ moneyRate?: number, repRate?: number }} [rates]
 * @returns {{ faction: string | null, augmentations: string[] }}
 */
export const selectAugmentations = (ownedAugmentations, staticData, cityFaction, factionRep = {}, { moneyRate = Infinity, repRate } = {}) => {
  const {
    augmentationPrices,
    augmentationRepReqs,
    augmentationPrereqs,
    augmentationStats = /** @type {Record<string,Multipliers>} */ ({}),
    factionAugmentations,
    factionRequirements = {},
  } = staticData;

  const MAX_AUGS = 6;
  const NEUROFLUX = "NeuroFlux Governor";

  const stillNeeds = (/** @type {string} */ aug) => !ownedAugmentations.includes(aug);
  const notNeuroFlux = (/** @type {string} */ aug) => aug !== NEUROFLUX;

  // Product of a multiplier key across installed augmentations.
  // Installed augs determine the player's stat multipliers for this run.
  // Cached since the same stat is queried for every skill-gated faction.
  const installedAugs = staticData.ownedAugmentations ?? [];
  const statProductCache = /** @type {Map<string, number>} */ (new Map());
  const getStatProduct = (/** @type {string} */ stat) => {
    if (statProductCache.has(stat)) return /** @type {number} */ (statProductCache.get(stat));
    let product = 1;
    for (const aug of installedAugs) {
      const mult = augmentationStats[aug]?.[/** @type {keyof Multipliers} */ (stat)];
      if (mult != null) product *= mult;
    }
    statProductCache.set(stat, product);
    return product;
  };

  // Derived from the game's log-scale XP→level formula:
  //   level ≈ statMult × log(expMult × xp)
  //   ∴ statProduct × log(STAT_BASE × expProduct) > req × K
  // STAT_BASE encodes natural XP accumulation without aug boosts — keeps the
  // function continuous and makes low requirements (e.g. CSEC) accessible
  // without installed augs. K and STAT_BASE are empirically determined.
  const STAT_BASE = 100;
  const STAT_ATTAINABILITY_K = 0.03;

  // Rep rate scales with hacking capability. When not supplied by the caller
  // (e.g. in tests or early in a run), derive it from installed aug multipliers
  // using the same formula as the attainability check.
  const effectiveRepRate = repRate ?? getStatProduct('hacking') * Math.log(STAT_BASE * getStatProduct('hacking_exp'));

  const accessibleFactions = [...STORY_FACTIONS, ...CITY_FACTIONS].filter((faction) => {
    const reqs = factionRequirements[faction] ?? [];
    const requiredAugCount =
      reqs.find((/** @type {any} */ req) => req.type === "numAugmentations")?.numAugmentations ?? 0;
    if (ownedAugmentations.length < requiredAugCount) return false;
    if (CITY_FACTIONS.includes(faction) && cityFaction != null && cityFaction !== faction)
      return false;
    const skillReqs = Object.assign(
      {},
      ...reqs.filter((/** @type {any} */ r) => r.type === 'skills').map((/** @type {any} */ r) => r.skills),
    );
    for (const [stat, required] of Object.entries(skillReqs)) {
      const score = getStatProduct(stat) * Math.log(STAT_BASE * getStatProduct(`${stat}_exp`));
      if (score <= /** @type {number} */ (required) * STAT_ATTAINABILITY_K) return false;
    }
    return true;
  });

  const getNeededAugs = (/** @type {string} */ faction) =>
    (factionAugmentations[faction] ?? []).filter(stillNeeds).filter(notNeuroFlux);

  const augValue = (/** @type {string} */ aug) => {
    const stats = augmentationStats[aug];
    return stats != null ? scoreAug(stats, DEFAULT_AUG_WEIGHTS) : 0;
  };

  // Reset overhead in seconds; decreases as the player has more installed augs.
  const resetOverhead = OVERHEAD_BASE / (1 + installedAugs.length);

  /**
   * Find the optimal batch of up to MAX_AUGS augs from a faction.
   * Cost is time (seconds): max(moneyTime, marginalRepTime) + resetOverhead.
   * Marginal rep excludes the cheapest aug's rep since that cost is committed once
   * the faction is targeted. Tries every aug as the binding rep tier — O(n²).
   * @param {string} faction
   * @returns {{ utility: number, batch: string[] }}
   */
  const findOptimalBatch = (faction) => {
    const currentRep = factionRep[faction] ?? 0;
    const augs = getNeededAugs(faction)
      .map((aug) => ({
        name: aug,
        value: augValue(aug),
        price: augmentationPrices[aug] ?? 0,
        remainingRep: Math.max(0, (augmentationRepReqs[aug] ?? 0) - currentRep),
      }))
      .sort((a, b) => a.remainingRep - b.remainingRep);

    let best = { utility: 0, batch: /** @type {string[]} */ ([]) };

    for (let i = 0; i < augs.length; i++) {
      // augs[0..i] are all augs with remainingRep ≤ augs[i].remainingRep.
      // Pick top MAX_AUGS by value from this affordable prefix.
      // .slice() gives a copy, so sorting it doesn't disturb the rep-ascending order of augs[]
      const affordable = augs.slice(0, i + 1)
        .sort((a, b) => b.value - a.value)
        .slice(0, MAX_AUGS);

      const totalValue = affordable.reduce((s, a) => s + a.value, 0);
      const totalPrice = affordable.reduce((s, a) => s + a.price, 0);
      const bindingRep = Math.max(...affordable.map((a) => a.remainingRep));
      const minRemainingRep = Math.min(...affordable.map((a) => a.remainingRep));

      const timeForMoney = totalPrice / moneyRate;
      const timeForRep = (bindingRep - minRemainingRep) / effectiveRepRate;
      const cost = Math.max(timeForMoney, timeForRep) + resetOverhead;
      const utility = totalValue / cost;

      if (utility > best.utility)
        best = { utility, batch: affordable.map((a) => a.name) };
    }

    return best;
  };

  const bestFaction = accessibleFactions.reduce(
    (best, faction) => {
      if (getNeededAugs(faction).length === 0) return best;
      const { utility } = findOptimalBatch(faction);
      return utility > best.utility ? { faction, utility } : best;
    },
    { faction: /** @type {string | null} */ (null), utility: -Infinity },
  ).faction;

  if (!bestFaction) return { faction: null, augmentations: [] };

  const getPurchaseOrder = (/** @type {string[]} */ augs) => {
    const order = new Set(/** @type {string[]} */ ([]));
    augs.sort((a, b) => (augmentationPrices[b] ?? 0) - (augmentationPrices[a] ?? 0));
    for (const aug of augs) {
      const prereqs = (augmentationPrereqs[aug] ?? []).filter(stillNeeds).reverse();
      for (const prereq of prereqs) order.add(prereq);
      order.add(aug);
    }
    return [...order].slice(0, MAX_AUGS);
  };

  const { batch: bestAugs } = findOptimalBatch(bestFaction);

  return { faction: bestFaction, augmentations: getPurchaseOrder(bestAugs) };
};
