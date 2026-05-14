import { getStaticData, getGoalsData, getPlayerData, getMoneyData } from "./data-store";
import { getRepTargets, getTargetFaction } from "./query-service";
import { MEDIUM } from "./colors";
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
 * }} Goal
 */

export const COMBAT_STATS = /** @type {(keyof Skills)[]} */ (["strength", "defense", "dexterity", "agility"]);

/**
 * @param {GoalType} type
 * @param {string} desc
 * @param {() => boolean} isDone
 * @param {number} [requirement]
 * @param {string} [faction]
 * @param {Goal[]} [deps]
 * @returns {Goal}
 */
const goal = (type, desc, isDone, requirement = undefined, faction = undefined, deps = []) => ({
  type,
  desc,
  isDone,
  requirement,
  faction,
  deps,
  toString: () => isDone() ? desc : MEDIUM(desc),
});

// --- Per-type factories ---

/** @param {string} poolServer @param {number} currentRam @param {number} requiredJobRam @returns {Goal} */
const jobRamGoal = (poolServer, currentRam, requiredJobRam) =>
  goal("JOB_RAM", `${requiredJobRam}GB on ${poolServer}`,
    () => currentRam >= requiredJobRam);

/** @param {Goal} dep @returns {Goal} */
const augSuiteGoal = (dep) =>
  goal("AUG_SUITE", "Run augmentation suite", () => false, undefined, undefined, [dep]);

/** @param {number} hackReq @param {number} currentHacking @returns {Goal} */
const hackingLevelGoal = (hackReq, currentHacking) =>
  goal("HACKING_LEVEL", `Hacking ≥ ${hackReq}`,
    () => currentHacking >= hackReq, hackReq);

/** @param {number} combatReq @param {Skills} currentSkills @returns {Goal} */
const combatLevelsGoal = (combatReq, currentSkills) =>
  goal("COMBAT_LEVELS", `Combat stats ≥ ${combatReq}`,
    () => COMBAT_STATS.every(stat => currentSkills[stat] >= combatReq), combatReq);

/** @param {NS} ns @param {number} moneyTarget @param {number} currentMoney @returns {Goal} */
const moneyPrereqGoal = (ns, moneyTarget, currentMoney) =>
  goal("MONEY", "Have $" + ns.format.number(moneyTarget, 1),
    () => currentMoney >= moneyTarget, moneyTarget);

/** @param {string} location @param {string} currentLocation @returns {Goal} */
const locationGoal = (location, currentLocation) =>
  goal("LOCATION", "Visit " + location,
    () => currentLocation === location, location);

/** @param {string} faction @param {string[]} factions @param {Goal[]} [deps] @returns {Goal} */
const factionJoinGoal = (faction, factions, deps = []) =>
  goal("FACTION_JOIN", "Join " + faction,
    () => factions.includes(faction), undefined, undefined, deps);

/** @param {string} faction @param {number} requirement @param {Record<string,number>} factionRep @param {Goal} dep @returns {Goal} */
const factionRepGoal = (faction, requirement, factionRep, dep) =>
  goal("FACTION_REP", `Gain ${requirement} rep (${faction})`,
    () => (factionRep?.[faction] ?? 0) >= requirement, requirement, faction, [dep]);

/** @param {NS} ns @param {number | undefined} costToAug @param {number} currentMoney @param {number} estimatedStockValue @returns {Goal} */
const augMoneyGoal = (ns, costToAug, currentMoney, estimatedStockValue) =>
  goal("AUG_MONEY",
    "Save " + (costToAug != null ? "$" + ns.format.number(costToAug, 1) : "?") + " for augmentations",
    () => costToAug != null && currentMoney + 0.9 * estimatedStockValue >= costToAug);

/** @param {string} aug @param {string[]} purchasedAugmentations @param {Goal[]} deps @returns {Goal} */
const augmentationGoal = (aug, purchasedAugmentations, deps) =>
  goal("AUGMENTATION", aug,
    () => purchasedAugmentations.includes(aug), undefined, undefined, deps);

// --- Orchestration ---

/** @param {NS} ns @returns {Goal[]} */
export const getGoals = (ns) => {
  const { factions, skills, money, location } = ns.getPlayer();
  const { factionRep, purchasedAugmentations } = getPlayerData(ns);
  const staticData = getStaticData(ns);
  const { requiredJobRam, factionRequirements } = staticData;
  const goalsData = getGoalsData(ns);
  const effectiveFaction = getTargetFaction(ns);
  const targetAugmentations = goalsData.targetAugmentations ?? staticData.targetAugmentations;

  if (targetAugmentations == null) {
    const POOL1 = `${THREADPOOL}-01`;
    const pool1Ram = ns.serverExists(POOL1) ? ns.getServerMaxRam(POOL1) : 0;
    const jrg = jobRamGoal(POOL1, pool1Ram, requiredJobRam);
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
        const g = moneyPrereqGoal(ns, moneyTarget, money);
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
    const rg = factionRepGoal(faction, requirement, factionRep, joinGoal);
    goals.push(rg);
    repGoals.push(rg);
  }

  const { estimatedStockValue = 0, costToAug } = getMoneyData(ns);
  const amg = augMoneyGoal(ns, costToAug, money, estimatedStockValue);
  goals.push(amg);

  goals.push(
    ...targetAugmentations.map((/** @type {string} */ aug) =>
      augmentationGoal(aug, purchasedAugmentations, [...repGoals, amg])),
  );

  return goals;
};
