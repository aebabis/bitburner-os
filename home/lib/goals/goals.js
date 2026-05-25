import { getStaticData, getGoalsData, getPlayerData, getMoneyData } from "../data-store.js";
import { THREADPOOL } from "../../etc/config.js";
import { jobRamGoal, installGoal } from "./nodes.js";
import { buildFactionGoalTree, isRepBound as isRepBoundPure } from "./tree.js";
import { getAccessibleFactions, computeResetOverhead } from "../aug-select.js";
import { getMockFormulas } from "../formulas.js";
import { needsAugRam, needsJobRam } from "../query-service.js";

/** @param {NS} ns @returns {import('./nodes.js').Goal[]} */
export const getGoals = (ns) => {
  const { player, factionRep, purchasedAugmentations = [], activeRepRate = {}, passiveRepRate = {} } = getPlayerData(ns);
  const { money } = player;
  const staticData = getStaticData(ns);
  const { requiredJobRam, requiredAugRam, purchasedServerCosts } = staticData;
  const { estimatedStockValue = 0, referenceIncome = 0 } = getMoneyData(ns);
  const goalsData = getGoalsData(ns);

  const formulas = ns.fileExists('Formulas.exe', 'home') ? ns.formulas : getMockFormulas(staticData);
  const karma = ns.heart.break();
  const ownedAugs = [...staticData.installedAugmentations, ...purchasedAugmentations];
  const planData = {
    player, staticData, factionRep: factionRep ?? {}, purchasedAugmentations, ownedAugs,
    money, estimatedStockValue, referenceIncome, activeRepRate, passiveRepRate,
    formulas, karma,
  };

  const overhead = computeResetOverhead(staticData);

  let bestPlan = null;
  if (goalsData.manualOverride && goalsData.targetFaction) {
    bestPlan = buildFactionGoalTree(goalsData.targetFaction, {
      ...planData, augsOverride: goalsData.targetAugmentations,
    });
  } else {
    const plans = getAccessibleFactions(staticData, player, ownedAugs)
      .map(f => buildFactionGoalTree(f, planData))
      .filter(/** @type {<T>(x: T | null) => x is T} */ (Boolean));
    if (plans.length > 0)
      bestPlan = plans.reduce((a, b) => a.utility(overhead) >= b.utility(overhead) ? a : b);
  }

  const POOL1 = `${THREADPOOL}-01`;
  const pool1Ram = ns.serverExists(POOL1) ? ns.getServerMaxRam(POOL1) : 0;

  if (bestPlan) {
    const ramGoals = [];

    if (needsAugRam(ns)) {
      const augRamCost = purchasedServerCosts?.[requiredAugRam] ?? 0;
      ramGoals.push(jobRamGoal(POOL1, pool1Ram, requiredAugRam, augRamCost, money, referenceIncome));
    }

    if (needsJobRam(ns) && referenceIncome > 0) {
      const baselineTTC = Math.max(...bestPlan.terminalGoals.map(g => g.timeToComplete() ?? Infinity));
      const jobRamCost = purchasedServerCosts?.[requiredJobRam] ?? 0;
      if (jobRamCost / referenceIncome < baselineTTC)
        ramGoals.push(jobRamGoal(POOL1, pool1Ram, requiredJobRam, jobRamCost, money, referenceIncome));
    }

    if (ramGoals.length > 0) {
      for (const g of bestPlan.goals) {
        if (g.type === 'AUGMENTATION' || g.type === 'INSTALL')
          g.deps.push(...ramGoals);
      }
      return [...ramGoals, ...bestPlan.goals];
    }

    return bestPlan.goals;
  }

  const jobRamCost = purchasedServerCosts?.[requiredJobRam] ?? 0;
  const jrg = jobRamGoal(POOL1, pool1Ram, requiredJobRam, jobRamCost, money, referenceIncome);
  return [jrg, installGoal([jrg])];
};

/** @param {NS} ns @returns {number | null} */
export const getTimeToComplete = (ns) => {
  const goals = getGoals(ns);
  const augGoals = goals.filter(g => g.type === 'AUGMENTATION');
  const roots = augGoals.length > 0 ? augGoals : goals.filter(g => g.type === 'INSTALL');
  if (roots.length === 0) return null;
  const times = roots.map(g => g.timeToComplete());
  if (times.some(t => t == null)) return null;
  return Math.max(.../** @type {number[]} */ (times));
};

/**
 * @param {NS} ns
 * @param {import('./nodes.js').Goal[]} [goals]
 * @returns {boolean}
 */
export const isRepBound = (ns, goals = getGoals(ns)) => isRepBoundPure(goals);
