import { getStaticData, getPlayerData, getMoneyData } from '../data-store.js';
import { THREADPOOL } from '../../etc/config.js';
import { jobRamGoal, installGoal } from './nodes.js';
import { buildFactionGoalTree, isRepBound as isRepBoundPure } from './tree.js';
import { getAccessibleFactions, computeResetOverhead } from '../aug-select.js';
import { getMockFormulas } from '../formulas.js';
import { needsAugRam, needsJobRam } from '../query-service.js';

/** @param {NS} ns @returns {import('./nodes.js').Goal[]} */
export const getGoals = (ns) => {
  const { player, factionRep, purchasedAugmentations = [] } = getPlayerData(ns);
  const { money } = player;
  const staticData = getStaticData(ns);
  const { requiredJobRam, requiredAugRam, purchasedServerCosts } = staticData;
  const { estimatedStockValue = 0, referenceIncome = 0 } = getMoneyData(ns);
  const formulas = ns.fileExists('Formulas.exe', 'home')
    ? ns.formulas
    : getMockFormulas(staticData);
  const karma = ns.heart.break();
  const ownedAugs = [
    ...staticData.installedAugmentations,
    ...purchasedAugmentations,
  ];
  const planData = {
    player,
    staticData,
    factionRep: factionRep ?? {},
    purchasedAugmentations,
    ownedAugs,
    money,
    estimatedStockValue,
    referenceIncome,
    formulas,
    karma,
  };

  const overhead = computeResetOverhead(staticData);

  const plans = getAccessibleFactions(staticData, player, ownedAugs)
    .map((f) => buildFactionGoalTree(f, planData))
    .filter(/** @type {<T>(x: T | null) => x is T} */ (Boolean));
  const bestPlan =
    plans.length > 0
      ? plans.reduce((a, b) =>
          a.utility(overhead) >= b.utility(overhead) ? a : b,
        )
      : null;

  const POOL1 = `${THREADPOOL}-01`;
  const pool1Ram = ns.serverExists(POOL1) ? ns.getServerMaxRam(POOL1) : 0;

  if (bestPlan) {
    const ramGoals = [];

    if (needsAugRam(ns)) {
      const augRamCost = purchasedServerCosts?.[requiredAugRam] ?? 0;
      ramGoals.push(
        jobRamGoal(
          POOL1,
          pool1Ram,
          requiredAugRam,
          augRamCost,
          money,
          referenceIncome,
        ),
      );
    }

    if (needsJobRam(ns) && referenceIncome > 0) {
      const baselineTTC = Math.max(
        ...bestPlan.terminalGoals.map((g) => g.timeToComplete() ?? Infinity),
      );
      const jobRamCost = purchasedServerCosts?.[requiredJobRam] ?? 0;
      if (jobRamCost / referenceIncome < baselineTTC)
        ramGoals.push(
          jobRamGoal(
            POOL1,
            pool1Ram,
            requiredJobRam,
            jobRamCost,
            money,
            referenceIncome,
          ),
        );
    }

    if ('installDesc' in bestPlan) {
      const install = installGoal(
        [...bestPlan.terminalGoals, ...ramGoals],
        bestPlan.installDesc,
      );
      return [...ramGoals, ...bestPlan.goals, install];
    }
    if (ramGoals.length > 0) {
      return [...ramGoals, ...bestPlan.goals];
    }

    return bestPlan.goals;
  }

  const jobRamCost = purchasedServerCosts?.[requiredJobRam] ?? 0;
  const jrg = jobRamGoal(
    POOL1,
    pool1Ram,
    requiredJobRam,
    jobRamCost,
    money,
    referenceIncome,
  );
  return [jrg, installGoal([jrg])];
};

/** @param {NS} ns @returns {number | null} */
export const getTimeToComplete = (ns) => {
  const goals = getGoals(ns);
  const installGoals = goals.filter((g) => g.type === 'INSTALL');
  const roots =
    installGoals.length > 0
      ? installGoals
      : goals.filter((g) => g.type === 'AUGMENTATION');
  if (roots.length === 0) return null;
  const times = roots.map((g) => g.timeToComplete());
  if (times.some((t) => t == null)) return null;
  return Math.max(.../** @type {number[]} */ (times));
};

/**
 * @param {NS} ns
 * @param {import('./nodes.js').Goal[]} [goals]
 * @returns {boolean}
 */
export const isRepBound = (ns, goals = getGoals(ns)) => isRepBoundPure(goals);
