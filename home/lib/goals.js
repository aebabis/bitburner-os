import { getStaticData, getGoalsData, getPlayerData, getMoneyData } from "./data-store";
import { DARK } from "./colors";
import { THREADPOOL } from "../etc/config";
import { findOptimalBatch, MAX_AUGS, getAccessibleFactions } from "./aug-select";
import { getMockFormulas } from "./formulas";

/**
 * @typedef {'JOB_RAM' | 'INSTALL' | 'FACTION_JOIN' | 'FACTION_REP' | 'AUGMENTATION' | 'COMBAT_LEVELS' | 'HACKING_LEVEL' | 'KILLS' | 'KARMA' | 'LOCATION' | 'MONEY' | 'AUG_MONEY'} GoalType
 */

/**
 * @typedef {{
 *   type: GoalType,
 *   desc: string,
 *   isDone: () => boolean,
 *   toString: () => string,
 *   requirement: number | undefined,
 *   faction: string | undefined,
 *   deps: Goal[],
 *   ownTime: () => number | null,
 * }} Goal
 */

export const COMBAT_STATS = /** @type {(keyof GymEnumType)[]} */ (["strength", "defense", "dexterity", "agility"]);

/**
 * @param {GoalType} type
 * @param {string} desc
 * @param {() => boolean} isDone
 * @param {{ requirement?: number, faction?: string, deps?: Goal[], ownTime?: () => number | null }} [opts]
 * @returns {Goal}
 */
const goal = (type, desc, isDone, { requirement, faction, deps = [], ownTime = () => null } = {}) => ({
  type,
  desc,
  isDone,
  requirement,
  faction,
  deps,
  ownTime,
  toString: () => isDone() ? desc : DARK(desc),
});

// --- Per-type factories ---

/** @param {string} poolServer @param {number} currentRam @param {number} requiredJobRam @param {number} jobRamCost @param {number} currentMoney @param {number} referenceIncome @returns {Goal} */
const jobRamGoal = (poolServer, currentRam, requiredJobRam, jobRamCost, currentMoney, referenceIncome) =>
  goal("JOB_RAM", `${requiredJobRam}GB on ${poolServer}`,
    () => currentRam >= requiredJobRam,
    {
      requirement: requiredJobRam,
      ownTime: () => referenceIncome > 0
        ? Math.max(0, jobRamCost - currentMoney) / referenceIncome
        : null,
    });

/** @param {Goal[]} deps @returns {Goal} */
const installGoal = (deps) =>
  goal("INSTALL", "Run augmentation suite", () => false, { deps, ownTime: () => 0 });

/** @param {number} hackReq @param {number} currentHacking @returns {Goal} */
const hackingLevelGoal = (hackReq, currentHacking) =>
  goal("HACKING_LEVEL", `Hacking ≥ ${hackReq}`,
    () => currentHacking >= hackReq,
    { requirement: hackReq });

/** @param {number} combatReq @param {Skills} currentSkills @returns {Goal} */
const combatLevelsGoal = (combatReq, currentSkills) =>
  goal("COMBAT_LEVELS", `Combat stats ≥ ${combatReq}`,
    () => COMBAT_STATS.every(stat => currentSkills[stat] >= combatReq),
    { requirement: combatReq });

/** @param {number} killsRequired @param {number} numPeopleKilled @returns {Goal} */
const killsGoal = (killsRequired, numPeopleKilled) =>
  goal("KILLS", `Kill ${killsRequired} people`,
    () => numPeopleKilled >= killsRequired,
    { requirement: numPeopleKilled, ownTime: () => (killsRequired - numPeopleKilled)*3 });

/** @param {number} karmaRequired @param {number} karma @returns {Goal} */
const karmaGoal = (karmaRequired, karma) =>
  goal("KARMA", `Have ${karmaRequired} karma`,
    () => karmaRequired >= karma,
    { requirement: karmaRequired, ownTime: () => -(karmaRequired - karma) });

/** @param {NS} ns @param {number} moneyTarget @param {number} currentMoney @param {number} referenceIncome @returns {Goal} */
const moneyPrereqGoal = (ns, moneyTarget, currentMoney, referenceIncome) =>
  goal("MONEY", "Have $" + ns.format.number(moneyTarget, 1),
    () => currentMoney >= moneyTarget,
    {
      requirement: moneyTarget,
      ownTime: () => referenceIncome > 0
        ? Math.max(0, moneyTarget - currentMoney) / referenceIncome
        : null,
    });

/** @param {string} location @param {string} currentLocation @returns {Goal} */
const locationGoal = (location, currentLocation) =>
  goal("LOCATION", "Visit " + location,
    () => currentLocation === location,
    { requirement: /** @type {any} */ (location), ownTime: () => 0 });

/** @param {string} faction @param {string[]} factions @param {Goal[]} [deps] @returns {Goal} */
const factionJoinGoal = (faction, factions, deps = []) =>
  goal("FACTION_JOIN", "Join " + faction,
    () => factions.includes(faction),
    { deps, ownTime: () => 0 });

/**
 * @param {string} faction
 * @param {number} requirement
 * @param {Record<string,number>} factionRep
 * @param {Goal} dep
 * @param {Record<string,number>} activeRepRate
 * @param {Record<string,number>} passiveRepRate
 * @returns {Goal}
 */
const factionRepGoal = (faction, requirement, factionRep, dep, activeRepRate, passiveRepRate) => {
  const currentRep = factionRep?.[faction] ?? 0;
  const rate = activeRepRate[faction] || passiveRepRate[faction] || 0;
  return goal("FACTION_REP", `Gain ${requirement} rep (${faction})`,
    () => currentRep >= requirement,
    {
      requirement, faction, deps: [dep],
      ownTime: () => rate > 0 ? Math.max(0, requirement - currentRep) / rate : null,
    });
};

/** @param {NS} ns @param {number | undefined} costToAug @param {number} currentMoney @param {number} estimatedStockValue @param {number} referenceIncome @returns {Goal} */
const augMoneyGoal = (ns, costToAug, currentMoney, estimatedStockValue, referenceIncome) => {
  const effectiveMoney = currentMoney + 0.9 * estimatedStockValue;
  return goal("AUG_MONEY",
    "Save " + (costToAug != null ? "$" + ns.format.number(costToAug, 1) : "?") + " for augmentations",
    () => costToAug != null && effectiveMoney >= costToAug,
    {
      requirement: costToAug,
      ownTime: () => costToAug != null && referenceIncome > 0
        ? Math.max(0, costToAug - effectiveMoney) / referenceIncome
        : null,
    });
};

/** @param {string} aug @param {string} faction @param {string[]} purchasedAugmentations @param {Goal[]} deps @returns {Goal} */
const augmentationGoal = (aug, faction, purchasedAugmentations, deps) =>
  goal("AUGMENTATION", aug,
    () => purchasedAugmentations.includes(aug),
    { faction, deps, ownTime: () => 0 });

// --- DAG traversal ---

/**
 * @param {Goal} goal
 * @param {Map<Goal, number | null>} [memo]
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

/**
 * Time to complete the overall plan: max timeToComplete across all terminal goals
 * (AUGMENTATION goals if any exist, INSTALL otherwise).
 * Returns null if any terminal goal's time is unknown.
 * @param {NS} ns
 * @returns {number | null}
 */
export const getTimeToComplete = (ns) => {
  const goals = getGoals(ns);
  const augGoals = goals.filter(g => g.type === 'AUGMENTATION');
  const roots = augGoals.length > 0 ? augGoals : goals.filter(g => g.type === 'INSTALL');
  if (roots.length === 0) return null;
  const memo = new Map();
  const times = roots.map(g => timeToComplete(g, memo));
  if (times.some(t => t == null)) return null;
  return Math.max(.../** @type {number[]} */ (times));
};

/** @param {NS} ns @param {Goal[]} goals */
export const isRepBound = (ns, goals = getGoals(ns)) => {
  const unmetRepGoals = goals.filter(g => g.type === 'FACTION_REP' && !g.isDone());
  if (unmetRepGoals.find((goal) => timeToComplete(goal) == null)) {
    return true;
  }
  const maxRepTime = unmetRepGoals.length > 0
    ? Math.max(...unmetRepGoals.map(g => timeToComplete(g) ?? 0))
    : 0;
  const amg = goals.find(g => g.type === 'AUG_MONEY');
  const moneyTime = amg != null ? timeToComplete(amg) : null;
  return moneyTime == null || moneyTime <= maxRepTime;
};

// --- Plan construction ---

/**
 * Build the complete goal chain for one candidate faction plan.
 * Returns null if findOptimalBatch finds nothing worth pursuing.
 * @param {string} faction
 * @param {NS} ns
 * @param {{
 *   player: Player,
 *   staticData: ReturnType<import("./data-store").getStaticData>,
 *   factionRep: Record<string, number>,
 *   purchasedAugmentations: string[],
 *   ownedAugs: string[],
 *   money: number,
 *   estimatedStockValue: number,
 *   referenceIncome: number,
 *   activeRepRate: Record<string, number>,
 *   passiveRepRate: Record<string, number>,
 *   augsOverride?: string[],
 * }} data
 * @returns {{ goals: Goal[], terminalGoals: Goal[] } | null}
 */
export const buildFactionGoalTree = (faction, ns, {
  player, staticData, factionRep, purchasedAugmentations, ownedAugs,
  money, estimatedStockValue, referenceIncome, activeRepRate, passiveRepRate,
  augsOverride = undefined,
}) => {
  const { factions, skills, location } = player;
  const { factionRequirements, augmentationRepReqs, augmentationPrices, augmentationPrereqs } = staticData;

  const formulas = ns.fileExists('Formulas.exe', 'home') ? ns.formulas : getMockFormulas(staticData);
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

  // Join prereqs
  const joinPrereqs = [];
  const requirements = factionRequirements?.[faction] ?? [];
  const skillReqs = Object.assign({}, ...requirements.filter((r) => r.type === 'skills').map((r) => r.skills));
  const karmaReq = requirements.find((r) => r.type === 'karma')?.karma ?? 0;
  const killsReq = requirements.find((r) => r.type === 'numPeopleKilled')?.numPeopleKilled ?? 0;
  const moneyTarget = requirements.find((r) => r.type === 'money')?.money;
  const hackReq = skillReqs.hacking;
  const combatReq = skillReqs.strength;
  const locationReqs = [
    ...requirements.filter((r) => r.type === 'city'),
    ...requirements.filter((r) => r.type === 'someCondition').flatMap((r) => r.conditions).filter((r) => r.type === 'city'),
  ].map((r) => r.city);

  if (hackReq != null) joinPrereqs.push(hackingLevelGoal(hackReq, skills.hacking));
  if (combatReq != null) joinPrereqs.push(combatLevelsGoal(combatReq, skills));
  if (killsReq) joinPrereqs.push(killsGoal(killsReq, player.numPeopleKilled ?? 0));
  if (karmaReq) joinPrereqs.push(karmaGoal(karmaReq, ns.heart.break()));
  if (!factions.includes(faction)) {
    if (moneyTarget) joinPrereqs.push(moneyPrereqGoal(ns, moneyTarget, money, referenceIncome));
    const [loc] = locationReqs;
    if (loc) joinPrereqs.push(locationGoal(loc, location));
  }

  const joinGoal = factionJoinGoal(faction, factions, joinPrereqs);

  const repReq = Math.max(...augs.map((aug) => augmentationRepReqs[aug] ?? 0), 0);
  const repGoal = factionRepGoal(faction, repReq, factionRep, joinGoal, activeRepRate, passiveRepRate);

  // Cost estimate accounts for already-queued augs (1.9× price multiplier per queued aug).
  let multiplier = 1.9 ** purchasedAugmentations.length;
  let costToAug = 0;
  for (const aug of sortedByPriceDesc(augs)) {
    costToAug += multiplier * (augmentationPrices[aug] ?? 0);
    multiplier *= 1.9;
  }

  const moneyGoal = augMoneyGoal(ns, costToAug, money, estimatedStockValue, referenceIncome);
  const augGoals = augs.map((aug) => augmentationGoal(aug, faction, purchasedAugmentations, [repGoal, moneyGoal]));

  return {
    goals: [...joinPrereqs, joinGoal, repGoal, moneyGoal, ...augGoals],
    terminalGoals: augGoals,
  };
};

// --- Orchestration ---

/** @param {NS} ns @returns {Goal[]} */
export const getGoals = (ns) => {
  const { player, factionRep, purchasedAugmentations = [], activeRepRate = {}, passiveRepRate = {} } = getPlayerData(ns);
  const { money } = player;
  const staticData = getStaticData(ns);
  const { requiredJobRam, purchasedServerCosts } = staticData;
  const { estimatedStockValue = 0, referenceIncome = 0 } = getMoneyData(ns);
  const goalsData = getGoalsData(ns);

  const ownedAugs = [...(staticData.ownedAugmentations ?? []), ...purchasedAugmentations];
  const planData = {
    player, staticData, factionRep: factionRep ?? {}, purchasedAugmentations, ownedAugs,
    money, estimatedStockValue, referenceIncome, activeRepRate, passiveRepRate,
  };

  /** @param {{ terminalGoals: Goal[] }} plan */
  const planTime = (plan) => {
    const times = plan.terminalGoals.map((g) => timeToComplete(g));
    return times.some((t) => t == null) ? Infinity : Math.max(.../** @type {number[]} */ (times));
  };

  let bestPlan = null;
  if (goalsData.manualOverride && goalsData.targetFaction) {
    bestPlan = buildFactionGoalTree(goalsData.targetFaction, ns, {
      ...planData, augsOverride: goalsData.targetAugmentations,
    });
  } else {
    const plans = getAccessibleFactions(staticData, player, ownedAugs)
      .map((f) => buildFactionGoalTree(f, ns, planData))
      .filter(/** @type {<T>(x: T | null) => x is T} */ (Boolean));
    if (plans.length > 0)
      bestPlan = plans.reduce((a, b) => planTime(a) <= planTime(b) ? a : b);
  }

  if (bestPlan) return bestPlan.goals;

  const POOL1 = `${THREADPOOL}-01`;
  const pool1Ram = ns.serverExists(POOL1) ? ns.getServerMaxRam(POOL1) : 0;
  const jobRamCost = purchasedServerCosts?.[requiredJobRam] ?? 0;
  const jrg = jobRamGoal(POOL1, pool1Ram, requiredJobRam, jobRamCost, money, referenceIncome);
  return [jrg, installGoal([jrg])];
};
