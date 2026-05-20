import {
  factionRepGoal, augMoneyGoal, augmentationGoal, neurofluxGoal, installGoal,
  NEUROFLUX, buildJoinSubtree,
} from "./nodes.js";
import { findOptimalBatch, MAX_AUGS, computeRepReq, computeAugCost, augValueFromStats } from "../aug-select.js";

/** @param {import('./nodes.js').Goal[]} goals @returns {boolean} */
export const isRepBound = (goals) => {
  const unmetRepGoals = goals.filter(g => g.type === 'FACTION_REP' && !g.isDone());
  if (unmetRepGoals.find(g => g.timeToComplete() == null)) return true;
  const maxRepTime = unmetRepGoals.length > 0
    ? Math.max(...unmetRepGoals.map(g => g.timeToComplete() ?? 0))
    : 0;
  const amg = goals.find(g => g.type === 'AUG_MONEY');
  const moneyTime = amg != null ? amg.timeToComplete() : null;
  return moneyTime == null || moneyTime <= maxRepTime;
};

/**
 * Build the complete goal chain for one candidate faction plan.
 * Returns null if findOptimalBatch finds nothing worth pursuing.
 * @param {string} faction
 * @param {{
 *   player: Player,
 *   staticData: ReturnType<import('../data-store.js').getStaticData>,
 *   factionRep: Record<string, number>,
 *   purchasedAugmentations: string[],
 *   ownedAugs: string[],
 *   money: number,
 *   referenceIncome: number,
 *   activeRepRate: Record<string, number>,
 *   passiveRepRate: Record<string, number>,
 *   formulas: ReturnType<import('../formulas.js').getMockFormulas>,
 *   karma: number,
 *   augsOverride?: string[],
 * }} data
 * @returns {{ goals: import('./nodes.js').Goal[], terminalGoals: import('./nodes.js').Goal[], value: number, utility: (overhead: number) => number } | null}
 */
export const buildFactionGoalTree = (faction, {
  player, staticData, factionRep, purchasedAugmentations, ownedAugs,
  money, referenceIncome, activeRepRate, passiveRepRate,
  formulas, karma, augsOverride = undefined,
}) => {
  const { augmentationPrices, augmentationPrereqs, augmentationStats } = staticData;
  const augValue = (/** @type {string} */ aug) => augValueFromStats(aug, augmentationStats);

  const moneyRate = referenceIncome || Infinity;

  let batch;
  if (augsOverride != null) {
    batch = augsOverride;
  } else {
    ({ batch } = findOptimalBatch(faction, staticData, player, formulas, factionRep, ownedAugs, { moneyRate, activeRepRate, passiveRepRate }));
  }
  if (batch.length === 0) return null;

  const stillNeeds = (/** @type {string} */ aug) => !ownedAugs.includes(aug);
  const sortedByPriceDesc = (/** @type {string[]} */ augs) =>
    [...augs].sort((a, b) => (augmentationPrices?.[b] ?? 0) - (augmentationPrices?.[a] ?? 0));

  const getPurchaseOrder = (/** @type {string[]} */ augs) => {
    const nfCount = augs.filter(a => a === NEUROFLUX).length;
    const order = new Set(/** @type {string[]} */ ([]));
    for (const aug of sortedByPriceDesc(augs.filter(a => a !== NEUROFLUX))) {
      const prereqs = (augmentationPrereqs?.[aug] ?? []).filter(stillNeeds).reverse();
      for (const prereq of prereqs) order.add(prereq);
      order.add(aug);
    }
    // Neuroflux goes last (cheap, always available) and may appear multiple times
    return [...order, ...Array(nfCount).fill(NEUROFLUX)].slice(0, MAX_AUGS);
  };

  const augs = getPurchaseOrder(batch);

  const repReq = computeRepReq(augs, staticData);
  const { joinPrereqs, joinGoal } = buildJoinSubtree(faction, {
    player, staticData, money, referenceIncome, karma, formulas,
  });
  const repRate = activeRepRate[faction]
    || passiveRepRate[faction]
    || formulas?.work.factionGains(player, 'hacking', staticData.factionFavor?.[faction])?.reputation * 5;
  const repGoal = factionRepGoal(faction, repReq, factionRep, joinGoal, repRate);

  const installedSet = new Set(staticData.installedAugmentations);
  const numQueued = purchasedAugmentations.filter(aug => !installedSet.has(aug)).length;
  const costToAug = computeAugCost(augs, staticData, numQueued);

  const moneyGoal = augMoneyGoal(costToAug, money, referenceIncome);

  // With queued augs the multiplier is already inflated. If we still need money,
  // installing now resets it to 1 — always cheaper for the remaining augs.
  // Rep persists through installs, so the main overhead is re-leveling after reset.
  // TODO: use formulas to estimate re-leveling time and replace the constant.
  const INSTALL_OVERHEAD_SEC = 60;
  const timeToMoneyGoal = referenceIncome > 0
    ? Math.max(0, costToAug - money) / referenceIncome
    : Infinity;
  if (numQueued > 0 && augs.length > 0 && timeToMoneyGoal > INSTALL_OVERHEAD_SEC) {
    const queuedAugs = purchasedAugmentations.filter(aug => !installedSet.has(aug));
    const queuedAugGoals = queuedAugs.map(aug =>
      augmentationGoal(aug, faction, purchasedAugmentations, [], augValue(aug)));
    const earlyInstall = installGoal(queuedAugGoals);
    const earlyValue = earlyInstall.value;
    return {
      goals: [...joinPrereqs, joinGoal, repGoal, ...queuedAugGoals, earlyInstall],
      terminalGoals: [earlyInstall],
      value: earlyValue,
      utility(overhead) {
        const t = earlyInstall.timeToComplete();
        return t != null && earlyValue > 0 ? earlyValue / (t + overhead) : 0;
      },
    };
  }

  const nfBaseOrdinal = purchasedAugmentations.filter(a => a === NEUROFLUX).length + 1;
  let nfOrdinal = nfBaseOrdinal;
  const augGoals = augs.map(aug =>
    aug === NEUROFLUX
      ? neurofluxGoal(nfOrdinal++, faction, purchasedAugmentations, [repGoal, moneyGoal], augValue(aug))
      : augmentationGoal(aug, faction, purchasedAugmentations, [repGoal, moneyGoal], augValue(aug)));

  const treeValue = augGoals.reduce((s, g) => s + g.value, 0);
  return {
    goals: [...joinPrereqs, joinGoal, repGoal, moneyGoal, ...augGoals],
    terminalGoals: augGoals,
    value: treeValue,
    utility(overhead) {
      const times = augGoals.map(g => g.timeToComplete());
      if (times.some(t => t == null) || treeValue === 0) return 0;
      return treeValue / (Math.max(.../** @type {number[]} */ (times)) + overhead);
    },
  };
};
