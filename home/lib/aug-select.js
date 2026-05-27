import {
  STORY_FACTIONS,
  CITY_FACTIONS,
  CRIMINAL_ORGANIZATIONS,
} from './factions.js';

/** @type {Record<keyof Multipliers, number>} */
export const DEFAULT_AUG_WEIGHTS = {
  // High — stats that increase reputation gain
  hacking: 10,
  hacking_chance: 10,
  hacking_speed: 10,
  hacking_exp: 10,
  faction_rep: 10,

  // Low-medium — rep/income acceleration
  hacking_money: 2,
  hacking_grow: 2,
  company_rep: 1,
  work_money: 1,

  // Low — combat stats
  strength: 1,
  defense: 1,
  dexterity: 1,
  agility: 1,
  strength_exp: 0.5,
  defense_exp: 0.5,
  dexterity_exp: 0.5,
  agility_exp: 0.5,

  // Low — hacknet (cost stats use reciprocal: lower value = better, treated as equivalent boost)
  hacknet_node_money: 1,
  hacknet_node_purchase_cost: 0.5,
  hacknet_node_ram_cost: 0.5,
  hacknet_node_core_cost: 0.5,
  hacknet_node_level_cost: 0.5,

  // Zero — not relevant for automated play in tested bitnodes
  charisma: 0,
  charisma_exp: 0,
  crime_money: 0,
  crime_success: 0,
  dnet_money: 0,
  bladeburner_max_stamina: 0,
  bladeburner_stamina_gain: 0,
  bladeburner_analysis: 0,
  bladeburner_success_chance: 0,
};

// Augs with no stats have hard-coded evaluations
const UNITY_AUGS = {
  'CashRoot Starter Kit': 0.5,
  'Neuroreceptor Management Implant': 1,
  'The Red Pill': 10,
};

/**
 * @param {Multipliers} stats
 * @param {Record<keyof Multipliers, number>} weights
 * @returns {number}
 */
export const scoreAug = (stats, weights) =>
  Object.entries(stats)
    .map(([key, stat = 1]) => {
      const mult = stat >= 1 ? stat : 1 / stat;
      return (mult - 1) * weights[key];
    })
    .reduce((a, b) => a + b, 0);

// Seconds of reset overhead modeled for the first aug run; decreases as more augs are installed.
const OVERHEAD_BASE = 120 * 60;

/**
 * Estimate reset overhead (seconds) for plan comparison — how long the next run will take to
 * reach this productive state. Uses actual run elapsed time as proxy (reproducible runs),
 * with a conservative floor for early-run estimates.
 * @param {{ resetInfo: any, installedAugmentations: string[] }} staticData
 * @returns {number}
 */
export const computeResetOverhead = (staticData) => {
  const installedAugs = staticData.installedAugmentations ?? [];
  const lastAugReset = staticData.resetInfo?.lastAugReset ?? 0;
  const timeSinceInstall =
    lastAugReset > 0 ? (Date.now() - lastAugReset) / 1000 : 0;
  return Math.max(timeSinceInstall, OVERHEAD_BASE / (1 + installedAugs.length));
};

// With queued augs the price multiplier is already inflated. Installing now resets it to 1,
// making the remaining augs cheaper. Rep persists through installs, so the main cost is
// re-leveling after reset. True if that reset cost is less than waiting for the full batch.
// TODO: use formulas to estimate re-leveling time and replace the constant.
const INSTALL_OVERHEAD_SEC = 60;

/**
 * @param {number} numQueued - augs purchased but not yet installed
 * @param {number} numTargeted - augs in the next planned batch
 * @param {number} costToAug - total money needed for the next batch
 * @param {number} liquidAssets - available money
 * @param {number} referenceIncome - current income rate ($/s)
 * @returns {boolean}
 */
export const shouldEarlyInstall = (
  numQueued,
  numTargeted,
  costToAug,
  liquidAssets,
  referenceIncome,
) => {
  if (numQueued === 0 || numTargeted === 0) return false;
  const timeToMoneyGoal =
    referenceIncome > 0
      ? Math.max(0, costToAug - liquidAssets) / referenceIncome
      : Infinity;
  return timeToMoneyGoal > INSTALL_OVERHEAD_SEC;
};

export const MAX_AUGS = 6;
const NEUROFLUX = 'NeuroFlux Governor';

/**
 * @param {string} aug
 * @param {Record<string, Multipliers> | undefined} augmentationStats
 * @returns {number}
 */
export const augValueFromStats = (aug, augmentationStats) => {
  if (Object.hasOwn(UNITY_AUGS, aug)) return UNITY_AUGS[aug];
  const stats = augmentationStats?.[aug];
  return stats != null ? scoreAug(stats, DEFAULT_AUG_WEIGHTS) : 0;
};

/**
 * @param {string[]} augs
 * @param {{ augmentationRepReqs?: Record<string,number> }} staticData
 * @returns {number}
 */
export const computeRepReq = (augs, staticData) =>
  Math.max(...augs.map((aug) => staticData.augmentationRepReqs?.[aug] ?? 0), 0);

/**
 * Total cost to purchase all augs in the batch, accounting for the 1.9× queue
 * multiplier (from already-queued augs) and the 1.14× per-level NF base scaling.
 * Augs are costed most-expensive-first so the queue multiplier compounds correctly.
 * @param {string[]} augs - purchase-ordered batch (NF may appear multiple times)
 * @param {{ augmentationPrices?: Record<string,number>, resetInfo?: any }} staticData
 * @param {number} numQueued - augs already purchased but not yet installed
 * @returns {number}
 */
export const computeAugCost = (augs, staticData, numQueued) => {
  const { augmentationPrices } = staticData;
  const installedNFCount = staticData.resetInfo?.ownedAugs?.get(NEUROFLUX) ?? 0;
  const sorted = [...augs].sort(
    (a, b) => (augmentationPrices?.[b] ?? 0) - (augmentationPrices?.[a] ?? 0),
  );
  let multiplier = 1.9 ** numQueued;
  let nfLevelOffset = installedNFCount;
  let cost = 0;
  for (const aug of sorted) {
    const nfLevelMult = aug === NEUROFLUX ? 1.14 ** nfLevelOffset++ : 1;
    cost += multiplier * (augmentationPrices?.[aug] ?? 0) * nfLevelMult;
    multiplier *= 1.9;
  }
  return cost;
};

/**
 * Find the optimal batch of up to MAX_AUGS augs from a faction.
 * Cost is time (seconds): (max(moneyTime, marginalRepTime) + resetOverhead + trainingTime)
 * Marginal rep excludes the cheapest aug's rep since that cost is committed once
 * the faction is targeted. Tries every aug as the binding rep tier — O(n²).
 * When the faction has donation access, rep cost folds into money cost via donationForRep.
 * @param {string} faction
 * @param {{
 *   augmentationPrices?: Record<string,number>,
 *   augmentationRepReqs?: Record<string,number>,
 *   augmentationStats?: Record<string,Multipliers>,
 *   factionAugmentations?: Record<string,string[]>,
 *   factionRequirements?: Record<string,any[]>,
 *   factionFavor?: Record<string,number>,
 *   favorToDonate?: number,
 *   serverBackdoorRequirements: any[],
 *   installedAugmentations: string[],
 * }} staticData
 * @param {Player} player
 * @param {ReturnType<typeof getMockFormulas>} formulas
 * @param {Record<string, number>} factionRep
 * @param {string[]} ownedAugmentations - installed + purchased (for stillNeeds filter)
 * @param {{ moneyRate?: number, repRate?: number, activeRepRate?: Record<string,number>, passiveRepRate?: Record<string,number> }} [opts]
 * @returns {{ utility: number, batch: string[] }}
 */
export const findOptimalBatch = (
  faction,
  staticData,
  player,
  formulas,
  factionRep,
  ownedAugmentations,
  {
    moneyRate = Infinity,
    repRate,
    activeRepRate,
    passiveRepRate,
    joinTime = 0,
  } = {},
) => {
  const {
    augmentationPrices,
    augmentationRepReqs,
    augmentationStats,
    factionAugmentations,
    factionFavor,
  } = staticData;

  const canDonate =
    (factionFavor?.[faction] ?? 0) >= (staticData.favorToDonate ?? Infinity);
  const donationRate = canDonate
    ? (formulas?.reputation?.donationForRep(1, player) ?? Infinity)
    : Infinity;

  // installedAugs (not purchasedAugmentations) determine the player's current stat multipliers.
  const installedAugs = staticData.installedAugmentations ?? [];

  const stillNeeds = (/** @type {string} */ aug) =>
    !ownedAugmentations.includes(aug);
  const getNeededAugs = (/** @type {string} */ fac) =>
    (factionAugmentations?.[fac] ?? [])
      .filter(stillNeeds)
      .filter((aug) => aug !== NEUROFLUX);

  const augValue = (/** @type {string} */ aug) =>
    augValueFromStats(aug, augmentationStats);

  const currentRep = factionRep[faction] ?? 0;
  const gainRate = formulas?.work.factionGains(
    player,
    'hacking',
    factionFavor?.[faction],
  );
  const effectiveRepRate =
    activeRepRate?.[faction] ??
    passiveRepRate?.[faction] ??
    repRate ??
    gainRate?.reputation * 5;

  const resetOverhead = computeResetOverhead(staticData);

  // Neuroflux is always available regardless of owned count — you can always buy more.
  // Add MAX_AUGS copies with compounding prices so the algorithm can fill a batch with it.
  // Each successive NF purchase raises the queue multiplier by 1.9 (like all augs) AND
  // raises NF's own base price/rep by 1.14 (NF-level scaling, separate from queue).
  const numQueued = ownedAugmentations.length - installedAugs.length;
  const installedNFCount = staticData.resetInfo?.ownedAugs?.get(NEUROFLUX) ?? 0;
  const nfBase = augmentationPrices?.[NEUROFLUX] ?? 0;
  const nfBaseRep = augmentationRepReqs?.[NEUROFLUX] ?? 0;
  const nfEntries = (factionAugmentations?.[faction] ?? []).includes(NEUROFLUX)
    ? Array.from({ length: MAX_AUGS }, (_, i) => ({
        name: NEUROFLUX,
        value: augValue(NEUROFLUX),
        price: nfBase * 1.9 ** (numQueued + i) * 1.14 ** (installedNFCount + i),
        remainingRep: Math.max(
          0,
          nfBaseRep * 1.14 ** (installedNFCount + i) - currentRep,
        ),
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
    const affordable = augs
      .slice(0, i + 1)
      .sort((a, b) => b.value - a.value)
      .slice(0, MAX_AUGS);

    const totalValue = affordable.reduce((s, a) => s + a.value, 0);
    const totalPrice = affordable.reduce((s, a) => s + a.price, 0);
    const bindingRep = Math.max(...affordable.map((a) => a.remainingRep));

    const effectivePrice = canDonate
      ? totalPrice + bindingRep * donationRate
      : totalPrice;
    const timeForMoney =
      Math.max(0, effectivePrice - (player.money ?? 0)) / moneyRate;
    const timeForRep = canDonate ? 0 : bindingRep / effectiveRepRate;
    const cost = joinTime + Math.max(timeForMoney, timeForRep) + resetOverhead;
    const utility = totalValue / cost;

    if (utility > best.utility)
      best = { utility, batch: affordable.map((a) => a.name) };
  }

  return best;
};

/**
 * Returns true when a softReset to gain donation access (favor path) is faster than direct
 * rep grinding for the given faction and aug batch parameters.
 * augTimeWithFavor: t_favor + t_reset + t_N1 (favor grind → softReset → donate next cycle)
 * augTimeWithoutFavor: max(t_rep, t_money) (direct grind this cycle)
 * @param {string} faction
 * @param {number} repRequired - total rep requirement for the batch (rep resets after softReset)
 * @param {number} augCost - money needed for the batch
 * @param {number} currentRep - current faction rep
 * @param {number} currentFavor - current faction favor
 * @param {number} repRate - rep/s
 * @param {number} moneyRate - $/s
 * @param {number} liquidAssets
 * @param {Player} player
 * @param {ReturnType<typeof getMockFormulas>} formulas
 * @param {{ installedAugmentations: string[], resetInfo: any, favorToDonate?: number }} staticData
 * @returns {boolean}
 */
export const shouldPursueFavor = (
  faction,
  repRequired,
  augCost,
  currentRep,
  currentFavor,
  repRate,
  moneyRate,
  liquidAssets,
  player,
  formulas,
  staticData,
) => {
  const { favorToDonate } = staticData;
  if (favorToDonate == null || currentFavor >= favorToDonate) return false;
  if (!formulas?.reputation || !repRate || !moneyRate) return false;

  const repForFavor = formulas.reputation.calculateFavorToRep(
    favorToDonate - currentFavor,
  );
  const donationRate = formulas.reputation.donationForRep(1, player);

  const tFavor = Math.max(0, repForFavor - currentRep) / repRate;
  const tReset = computeResetOverhead(staticData);
  const tN1 = (repRequired * donationRate + augCost) / moneyRate;
  const augTimeWithFavor = tFavor + tReset + tN1;

  const augTimeWithoutFavor = Math.max(
    Math.max(0, repRequired - currentRep) / repRate,
    Math.max(0, augCost - liquidAssets) / moneyRate,
  );

  return augTimeWithFavor < augTimeWithoutFavor;
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
export const getAccessibleFactions = (
  staticData,
  player,
  ownedAugmentations,
) => {
  const { factionRequirements } = staticData;
  return [
    ...STORY_FACTIONS,
    ...CRIMINAL_ORGANIZATIONS,
    ...CITY_FACTIONS,
  ].filter((faction) => {
    const reqs = factionRequirements?.[faction] ?? [];
    const disqualifiers = reqs
      .filter((req) => req.type === 'not')
      .map((req) => req.condition);
    const requiredAugCount =
      reqs.find((/** @type {any} */ req) => req.type === 'numAugmentations')
        ?.numAugmentations ?? 0;
    if (ownedAugmentations.length < requiredAugCount) return false;
    if (
      CITY_FACTIONS.includes(faction) &&
      player.factions?.find(
        (other) => CITY_FACTIONS.includes(other) && other !== faction,
      )
    )
      return false;
    if (
      disqualifiers.some(
        (req) => req.type === 'employedBy' && player.jobs?.[req.company],
      )
    )
      return false;
    if (
      reqs.some(
        (req) =>
          req.type === 'someCondition' &&
          req.conditions.some((req) => req.type === 'jobTitle'),
      )
    ) {
      // TODO: Actually evaluate difficulty of obtaining job
      return false;
    }
    return true;
  });
};
