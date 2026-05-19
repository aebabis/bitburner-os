import {
  hackingLevelGoal, combatLevelsGoal, killsGoal, karmaGoal, moneyPrereqGoal,
  locationGoal, factionJoinGoal, factionRepGoal, augMoneyGoal, augmentationGoal, installGoal,
} from "./nodes.js";
import { findOptimalBatch, MAX_AUGS } from "../aug-select.js";

/**
 * @param {import('./nodes.js').Goal} goal
 * @param {Map<import('./nodes.js').Goal, number | null>} [memo]
 * @returns {number | null}
 */
export const timeToComplete = (goal, memo = new Map()) => {
  if (goal.isDone()) return 0;
  if (memo.has(goal)) return memo.get(goal);
  const depsMax = goal.deps.length === 0 ? 0
    : Math.max(...goal.deps.map(d => timeToComplete(d, memo) ?? Infinity));
  const result = depsMax === Infinity || goal.ownTime() == null
    ? null
    : depsMax + goal.ownTime();
  memo.set(goal, result);
  return result;
};

/** @param {import('./nodes.js').Goal[]} goals @returns {boolean} */
export const isRepBound = (goals) => {
  const unmetRepGoals = goals.filter(g => g.type === 'FACTION_REP' && !g.isDone());
  if (unmetRepGoals.find(g => timeToComplete(g) == null)) return true;
  const maxRepTime = unmetRepGoals.length > 0
    ? Math.max(...unmetRepGoals.map(g => timeToComplete(g) ?? 0))
    : 0;
  const amg = goals.find(g => g.type === 'AUG_MONEY');
  const moneyTime = amg != null ? timeToComplete(amg) : null;
  return moneyTime == null || moneyTime <= maxRepTime;
};

/**
 * @param {string} faction
 * @param {{
 *   player: Player,
 *   staticData: ReturnType<import('../data-store.js').getStaticData>,
 *   factionRep: Record<string, number>,
 *   money: number,
 *   referenceIncome: number,
 *   karma: number,
 * }} data
 * @returns {{ joinPrereqs: import('./nodes.js').Goal[], joinGoal: import('./nodes.js').Goal }}
 */
const buildJoinSubtree = (faction, {
  player, staticData, money, referenceIncome, karma,
}) => {
  const { factions, skills, location } = player;
  const { factionRequirements } = staticData;

  if (factions.includes(faction)) {
    return { joinPrereqs: [], joinGoal: factionJoinGoal(faction, factions, []) };
  }

  const joinPrereqs = [];
  const requirements = factionRequirements?.[faction] ?? [];
  const skillReqs = Object.assign({}, ...requirements.filter(r => r.type === 'skills').map(r => r.skills));
  const karmaReq = requirements.find(r => r.type === 'karma')?.karma ?? 0;
  const killsReq = requirements.find(r => r.type === 'numPeopleKilled')?.numPeopleKilled ?? 0;
  const moneyTarget = requirements.find(r => r.type === 'money')?.money;
  const hackReq = skillReqs.hacking;
  const combatReq = skillReqs.strength;
  const locationReqs = [
    ...requirements.filter(r => r.type === 'city'),
    ...requirements.filter(r => r.type === 'someCondition').flatMap(r => r.conditions).filter(r => r.type === 'city'),
  ].map(r => r.city);

  if (hackReq != null) joinPrereqs.push(hackingLevelGoal(hackReq, skills.hacking));
  if (combatReq != null) joinPrereqs.push(combatLevelsGoal(combatReq, skills));
  if (killsReq) joinPrereqs.push(killsGoal(killsReq, player.numPeopleKilled ?? 0));
  if (karmaReq) joinPrereqs.push(karmaGoal(karmaReq, karma));
  if (!factions.includes(faction)) {
    if (moneyTarget) joinPrereqs.push(moneyPrereqGoal(moneyTarget, money, referenceIncome));
    const [loc] = locationReqs;
    if (loc) joinPrereqs.push(locationGoal(loc, location));
  }

  const joinGoal = factionJoinGoal(faction, factions, joinPrereqs);
  return { joinPrereqs, joinGoal };
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
 * @returns {{ goals: import('./nodes.js').Goal[], terminalGoals: import('./nodes.js').Goal[] } | null}
 */
export const buildFactionGoalTree = (faction, {
  player, staticData, factionRep, purchasedAugmentations, ownedAugs,
  money, referenceIncome, activeRepRate, passiveRepRate,
  formulas, karma, augsOverride = undefined,
}) => {
  const { augmentationRepReqs, augmentationPrices, augmentationPrereqs } = staticData;

  const activeRates = Object.values(activeRepRate);
  const repRate = activeRates.length > 0 ? Math.max(...activeRates) : undefined;
  const moneyRate = referenceIncome || Infinity;

  let batch;
  if (augsOverride != null) {
    batch = augsOverride;
  } else {
    ({ batch } = findOptimalBatch(faction, staticData, player, formulas, factionRep, ownedAugs, { moneyRate, repRate }));
  }
  if (batch.length === 0) return null;

  const stillNeeds = (/** @type {string} */ aug) => !ownedAugs.includes(aug);
  const sortedByPriceDesc = (/** @type {string[]} */ augs) =>
    [...augs].sort((a, b) => (augmentationPrices[b] ?? 0) - (augmentationPrices[a] ?? 0));

  const getPurchaseOrder = (/** @type {string[]} */ augs) => {
    const order = new Set(/** @type {string[]} */ ([]));
    for (const aug of sortedByPriceDesc(augs)) {
      const prereqs = (augmentationPrereqs[aug] ?? []).filter(stillNeeds).reverse();
      for (const prereq of prereqs) order.add(prereq);
      order.add(aug);
    }
    return [...order].slice(0, MAX_AUGS);
  };

  const augs = getPurchaseOrder(batch);

  const repReq = Math.max(...augs.map(aug => augmentationRepReqs[aug] ?? 0), 0);
  const { joinPrereqs, joinGoal } = buildJoinSubtree(faction, {
    player, staticData, factionRep, money, referenceIncome, karma,
  });
  const repGoal = factionRepGoal(faction, repReq, factionRep, joinGoal, activeRepRate, passiveRepRate);

  const installedSet = new Set(staticData.ownedAugmentations ?? []);
  const numQueued = purchasedAugmentations.filter(aug => !installedSet.has(aug)).length;
  let multiplier = 1.9 ** numQueued;
  let costToAug = 0;
  for (const aug of sortedByPriceDesc(augs)) {
    costToAug += multiplier * (augmentationPrices[aug] ?? 0);
    multiplier *= 1.9;
  }

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
      augmentationGoal(aug, faction, purchasedAugmentations, []));
    const earlyInstall = installGoal(queuedAugGoals);
    return {
      goals: [...joinPrereqs, joinGoal, repGoal, ...queuedAugGoals, earlyInstall],
      terminalGoals: [earlyInstall],
    };
  }

  const augGoals = augs.map(aug => augmentationGoal(aug, faction, purchasedAugmentations, [repGoal, moneyGoal]));

  return {
    goals: [...joinPrereqs, joinGoal, repGoal, moneyGoal, ...augGoals],
    terminalGoals: augGoals,
  };
};
