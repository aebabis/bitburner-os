import { getStaticData, getGoalsData, getPlayerData, getMoneyData } from "./data-store";
import { getRepTargets, getTargetFaction } from "./query-service";
import { DARK } from "./colors";
import { THREADPOOL } from "../etc/config";

/**
 * @typedef {'JOB_RAM' | 'AUG_SUITE' | 'FACTION_JOIN' | 'FACTION_REP' | 'AUGMENTATION' | 'COMBAT_LEVELS' | 'HACKING_LEVEL' | 'LOCATION' | 'MONEY' | 'AUG_MONEY'} GoalType
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

/** @param {Goal} dep @returns {Goal} */
const augSuiteGoal = (dep) =>
  goal("AUG_SUITE", "Run augmentation suite", () => false, { deps: [dep] });

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

/** @param {string} aug @param {string[]} purchasedAugmentations @param {Goal[]} deps @returns {Goal} */
const augmentationGoal = (aug, purchasedAugmentations, deps) =>
  goal("AUGMENTATION", aug,
    () => purchasedAugmentations.includes(aug),
    { deps, ownTime: () => 0 });

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
 * (AUGMENTATION goals if any exist, AUG_SUITE otherwise).
 * Returns null if any terminal goal's time is unknown.
 * @param {NS} ns
 * @returns {number | null}
 */
export const getTimeToComplete = (ns) => {
  const goals = getGoals(ns);
  const augGoals = goals.filter(g => g.type === 'AUGMENTATION');
  const roots = augGoals.length > 0 ? augGoals : goals.filter(g => g.type === 'AUG_SUITE');
  if (roots.length === 0) return null;
  const memo = new Map();
  const times = roots.map(g => timeToComplete(g, memo));
  if (times.some(t => t == null)) return null;
  return Math.max(.../** @type {number[]} */ (times));
};

// --- Orchestration ---

/** @param {NS} ns @returns {Goal[]} */
export const getGoals = (ns) => {
  const { player, factionRep, purchasedAugmentations, activeRepRate = {}, passiveRepRate = {} } = getPlayerData(ns);
  const { factions, skills, money, location } = player;
  const staticData = getStaticData(ns);
  const { requiredJobRam, factionRequirements, purchasedServerCosts } = staticData;
  const { estimatedStockValue = 0, costToAug, referenceIncome = 0 } = getMoneyData(ns);
  const goalsData = getGoalsData(ns);
  const effectiveFaction = getTargetFaction(ns);
  const targetAugmentations = goalsData.targetAugmentations ?? staticData.targetAugmentations;

  if (targetAugmentations == null) {
    const POOL1 = `${THREADPOOL}-01`;
    const pool1Ram = ns.serverExists(POOL1) ? ns.getServerMaxRam(POOL1) : 0;
    const jobRamCost = purchasedServerCosts?.[requiredJobRam] ?? 0;
    const jrg = jobRamGoal(POOL1, pool1Ram, requiredJobRam, jobRamCost, money, referenceIncome);
    return [jrg, augSuiteGoal(jrg)];
  }

  const repTargets = getRepTargets(ns);
  const goals = [];

  const joinPrereqs = [];
  const nonGangTarget = repTargets.find((target) => !target.isGang);
  if (nonGangTarget) {
    const requirements = factionRequirements?.[nonGangTarget.faction] ?? [];
    const skillReqs = Object.assign({}, ...requirements
      .filter((req) => req.type === 'skills')
      .map((req) => req.skills));
    const moneyTarget = requirements.find((req) => req.type === 'money')?.money;
    const combatReq = skillReqs.strength;
    const hackReq = skillReqs.hacking;
    const locationReqs = [
      ...requirements.filter((req) => req.type === 'city'),
      ...requirements.filter((req) => req.type === 'someCondition')
        .flatMap((req) => req.conditions).filter((req) => req.type === 'city')
    ].map((req) => req.city);

    if (hackReq != null) {
      const g = hackingLevelGoal(hackReq, skills.hacking);
      goals.push(g);
      joinPrereqs.push(g);
    }
    if (combatReq != null) {
      const g = combatLevelsGoal(combatReq, skills);
      goals.push(g);
      joinPrereqs.push(g);
    }
    // Money and location sub-goals for joining a faction
    // are no longer considered requirements once the
    // faction is joined.
    // The level goals above are kept because they can't
    // be invalidated, but they could be nested here to
    // save space in the user's dashboard.
    if (!factions.includes(nonGangTarget.faction)) {
      if (moneyTarget) {
        const g = moneyPrereqGoal(ns, moneyTarget, money, referenceIncome);
        goals.push(g);
        joinPrereqs.push(g);
      }
      const [loc] = locationReqs;
      if (loc) {
        const g = locationGoal(loc, location);
        goals.push(g);
        joinPrereqs.push(g);
      }
    }
  }

  const effectiveFactionPrereqs = nonGangTarget?.faction === effectiveFaction ? joinPrereqs : [];
  const effectiveJoinGoal = factionJoinGoal(effectiveFaction, factions, effectiveFactionPrereqs);
  goals.push(effectiveJoinGoal);

  const repGoals = [];
  for (const { faction, requirement } of getRepTargets(ns)) {
    let joinGoal = effectiveJoinGoal;
    if (faction !== effectiveFaction) {
      const factionPrereqs = faction === nonGangTarget?.faction ? joinPrereqs : [];
      joinGoal = factionJoinGoal(faction, factions, factionPrereqs);
      goals.push(joinGoal);
    }
    const rg = factionRepGoal(faction, requirement, factionRep, joinGoal, activeRepRate, passiveRepRate);
    goals.push(rg);
    repGoals.push(rg);
  }

  const amg = augMoneyGoal(ns, costToAug, money, estimatedStockValue, referenceIncome);
  goals.push(amg);

  goals.push(
    ...targetAugmentations.map((/** @type {string} */ aug) =>
      augmentationGoal(aug, purchasedAugmentations, [...repGoals, amg])),
  );

  return goals;
};
