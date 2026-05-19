import { STORY_FACTIONS, CITY_FACTIONS, CRIMINAL_ORGANIZATIONS } from "./factions.js";
import { getMockFormulas } from "./formulas.js";
import { buildJoinSubtree } from "./goals/nodes.js";

/** @type {Record<keyof Multipliers, number>} */
export const DEFAULT_AUG_WEIGHTS = {
  // High — stats that increase reputation gain
  hacking:        10,
  hacking_chance: 10,
  hacking_speed:  10,
  hacking_exp:    10,
  faction_rep:    10,

  // Low-medium — rep/income acceleration
  hacking_money:   2,
  hacking_grow:    2,
  company_rep:  1,
  work_money:   1,

  // Low — combat stats
  strength:      1,
  defense:       1,
  dexterity:     1,
  agility:       1,
  strength_exp:  0.5,
  defense_exp:   0.5,
  dexterity_exp: 0.5,
  agility_exp:   0.5,

  // Low — hacknet (cost stats use reciprocal: lower value = better, treated as equivalent boost)
  hacknet_node_money:         1,
  hacknet_node_purchase_cost: .5,
  hacknet_node_ram_cost:      .5,
  hacknet_node_core_cost:     .5,
  hacknet_node_level_cost:    .5,

  // Zero — not relevant for automated play in tested bitnodes
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

// Augs with no stats have hard-coded evaluations
const UNITY_AUGS = {
  'CashRoot Starter Kit': .5,
  'Neuroreceptor Management Implant': .1,
  'The Red Pill': 10,
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

export const MAX_AUGS = 6;
const NEUROFLUX = "NeuroFlux Governor";

/**
 * Find the optimal batch of up to MAX_AUGS augs from a faction.
 * Cost is time (seconds): (max(moneyTime, marginalRepTime) + resetOverhead + trainingTime)
 * Marginal rep excludes the cheapest aug's rep since that cost is committed once
 * the faction is targeted. Tries every aug as the binding rep tier — O(n²).
 * @param {string} faction
 * @param {{
 *   augmentationPrices?: Record<string,number>,
 *   augmentationRepReqs?: Record<string,number>,
 *   augmentationStats?: Record<string,Multipliers>,
 *   factionAugmentations?: Record<string,string[]>,
 *   factionRequirements?: Record<string,any[]>,
 *   factionFavor?: Record<string,number>,
 *   serverBackdoorRequirements: any[],
 *   ownedAugmentations?: string[],
 * }} staticData
 * @param {Player} player
 * @param {ReturnType<typeof getMockFormulas>} formulas
 * @param {Record<string, number>} factionRep
 * @param {string[]} ownedAugmentations - installed + purchased (for stillNeeds filter)
 * @param {{ moneyRate?: number, repRate?: number, activeRepRate?: Record<string,number>, passiveRepRate?: Record<string,number> }} [opts]
 * @returns {{ utility: number, batch: string[] }}
 */
export const findOptimalBatch = (faction, staticData, player, formulas, factionRep, ownedAugmentations, { moneyRate = Infinity, repRate, activeRepRate, passiveRepRate } = {}) => {
  const {
    augmentationPrices,
    augmentationRepReqs,
    augmentationStats,
    factionAugmentations,
    factionFavor,
  } = staticData;

  // installedAugs (not purchasedAugmentations) determine the player's current stat multipliers.
  const installedAugs = staticData.ownedAugmentations ?? [];

  const stillNeeds = (/** @type {string} */ aug) => !ownedAugmentations.includes(aug);
  const getNeededAugs = (/** @type {string} */ fac) =>
    (factionAugmentations?.[fac] ?? []).filter(stillNeeds).filter((aug) => aug !== NEUROFLUX);

  const augValue = (/** @type {string} */ aug) => {
    if (Object.hasOwn(UNITY_AUGS, aug)) return UNITY_AUGS[aug];
    const stats = augmentationStats?.[aug];
    return stats != null ? scoreAug(stats, DEFAULT_AUG_WEIGHTS) : 0;
  };

  const resetOverhead = OVERHEAD_BASE / (1 + installedAugs.length);
  const currentRep = factionRep[faction] ?? 0;
  const effectiveRepRate = activeRepRate?.[faction] ?? passiveRepRate?.[faction] ?? repRate ?? formulas.work.factionGains(player, 'hacking', factionFavor?.[faction]).reputation * 5;
  const { joinGoal } = buildJoinSubtree(faction, {
    player, staticData, money: player.money ?? 0, referenceIncome: moneyRate, karma: player.karma ?? 0, formulas,
  });
  const joinTime = joinGoal.timeToComplete() ?? 0;

  // Neuroflux is always available regardless of owned count — you can always buy more.
  // Add MAX_AUGS copies with compounding prices so the algorithm can fill a batch with it.
  // Each successive NF purchase raises the queue multiplier by 1.9 (like all augs) AND
  // raises NF's own base price/rep by 1.14 (NF-level scaling, separate from queue).
  const numQueued = ownedAugmentations.length - installedAugs.length;
  const nfBase = augmentationPrices?.[NEUROFLUX] ?? 0;
  const nfBaseRep = augmentationRepReqs?.[NEUROFLUX] ?? 0;
  const nfEntries = (factionAugmentations?.[faction] ?? []).includes(NEUROFLUX)
    ? Array.from({ length: MAX_AUGS }, (_, i) => ({
        name: NEUROFLUX,
        value: augValue(NEUROFLUX),
        price: nfBase * (1.9 ** (numQueued + i)) * (1.14 ** i),
        remainingRep: Math.max(0, nfBaseRep * (1.14 ** i) - currentRep),
      }))
    : [];

  const augs = [
    ...getNeededAugs(faction).map((aug) => ({
      name: aug,
      value: augValue(aug),
      price: augmentationPrices?.[aug] ?? 0,
      remainingRep: Math.max(0, (augmentationRepReqs?.[aug] ?? 0) - currentRep),
    })),
    ...nfEntries,
  ].sort((a, b) => a.remainingRep - b.remainingRep);

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
    const cost = joinTime + Math.max(timeForMoney, timeForRep) + resetOverhead;
    const utility = totalValue / cost;

    if (utility > best.utility)
      best = { utility, batch: affordable.map((a) => a.name) };
  }

  return best;
};

/**
 * Hard gates: numAugmentations (can't install more augs mid-run) and city exclusivity.
 * Skill requirements are NOT hard gates — they become a cost multiplier in findOptimalBatch
 * so that harder-to-join factions are penalised but never completely excluded.
 * @param {{ factionRequirements: Record<string,any[]> }} staticData
 * @param {Player} player
 * @param {string[]} ownedAugmentations
 * @returns {string[]}
 */
export const getAccessibleFactions = (staticData, player, ownedAugmentations) => {
  const { factionRequirements } = staticData;
  return [...STORY_FACTIONS, ...CRIMINAL_ORGANIZATIONS, ...CITY_FACTIONS].filter((faction) => {
    const reqs = factionRequirements?.[faction] ?? [];
    const disqualifiers = reqs.filter((req) => req.type === 'not').map((req) => req.condition);
    const requiredAugCount =
      reqs.find((/** @type {any} */ req) => req.type === "numAugmentations")?.numAugmentations ?? 0;
    if (ownedAugmentations.length < requiredAugCount) return false;
    if (CITY_FACTIONS.includes(faction) && player.factions?.find((other) => CITY_FACTIONS.includes(other) && other !== faction))
      return false;
    if (disqualifiers.some((req) => req.type === 'employedBy' && player.jobs?.[req.company])) return false;
    if (reqs.some((req) => req.type === 'someCondition' && req.conditions.some((req) => req.type === 'jobTitle'))) {
      // TODO: Actually evaluate difficulty of obtaining job
      return false;
    }
    return true;
  });
};

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
 * @param {Player} player
 * @param {ReturnType<typeof getMockFormulas>} [formulas]
 * @param {Record<string, number>} [factionRep]
 * @param {{ moneyRate?: number, repRate?: number }} [rates]
 * @returns {{ faction: string | null, augmentations: string[] }}
 */
export const selectAugmentations = (
  ownedAugmentations,
  staticData,
  player,
  formulas = getMockFormulas(staticData),
  factionRep = {},
  { moneyRate = Infinity, repRate } = {}
) => {
  const {
    augmentationPrices,
    augmentationPrereqs,
    augmentationRepReqs,
    augmentationStats,
    factionAugmentations,
    factionRequirements,
  } = staticData;
  if ([augmentationPrices, augmentationRepReqs, augmentationPrereqs, augmentationStats, factionAugmentations, factionRequirements]
    .some((data) => data == null)) {
    return { faction: null, augmentations: [] };
  }

  const stillNeeds = (/** @type {string} */ aug) => !ownedAugmentations.includes(aug);
  const accessibleFactions = getAccessibleFactions(staticData, player, ownedAugmentations);

  const getNeededAugs = (/** @type {string} */ faction) => {
    const unique = (factionAugmentations[faction] ?? []).filter(stillNeeds).filter((aug) => aug !== NEUROFLUX);
    // A faction that sells Neuroflux always has something to offer
    return (factionAugmentations[faction] ?? []).includes(NEUROFLUX) ? [...unique, NEUROFLUX] : unique;
  };

  const batchOpts = { moneyRate, repRate };
  const bestFaction = accessibleFactions.reduce(
    (best, faction) => {
      if (getNeededAugs(faction).length === 0) return best;
      const { utility } = findOptimalBatch(faction, staticData, player, formulas, factionRep, ownedAugmentations, batchOpts);
      return utility > best.utility ? { faction, utility } : best;
    },
    { faction: /** @type {string | null} */ (null), utility: -Infinity },
  ).faction;

  if (!bestFaction) return { faction: null, augmentations: [] };

  const getPurchaseOrder = (/** @type {string[]} */ augs) => {
    const nfCount = augs.filter(a => a === NEUROFLUX).length;
    const unique = augs.filter(a => a !== NEUROFLUX)
      .sort((a, b) => (augmentationPrices[b] ?? 0) - (augmentationPrices[a] ?? 0));
    const order = new Set(/** @type {string[]} */ ([]));
    for (const aug of unique) {
      const prereqs = (augmentationPrereqs[aug] ?? []).filter(stillNeeds).reverse();
      for (const prereq of prereqs) order.add(prereq);
      order.add(aug);
    }
    // Neuroflux goes last (cheap, always available) and may appear multiple times
    return [...order, ...Array(nfCount).fill(NEUROFLUX)].slice(0, MAX_AUGS);
  };

  const { batch: bestAugs } = findOptimalBatch(bestFaction, staticData, player, formulas, factionRep, ownedAugmentations, batchOpts);
  return { faction: bestFaction, augmentations: getPurchaseOrder(bestAugs) };
};
