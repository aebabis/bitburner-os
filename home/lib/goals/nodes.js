import { DARK } from "../colors.js";

const fmt = new Intl.NumberFormat("en", { notation: "compact" });
const fmtMoney = (/** @type {number} */ n) => '$' + fmt.format(n);

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
  type, desc, isDone, requirement, faction, deps, ownTime,
  toString: () => isDone() ? desc : DARK(desc),
});

/** @param {string} poolServer @param {number} currentRam @param {number} requiredJobRam @param {number} jobRamCost @param {number} currentMoney @param {number} referenceIncome @returns {Goal} */
export const jobRamGoal = (poolServer, currentRam, requiredJobRam, jobRamCost, currentMoney, referenceIncome) =>
  goal("JOB_RAM", `${requiredJobRam}GB on ${poolServer}`,
    () => currentRam >= requiredJobRam,
    {
      requirement: requiredJobRam,
      ownTime: () => referenceIncome > 0 ? Math.max(0, jobRamCost - currentMoney) / referenceIncome : null,
    });

/** @param {import('./nodes.js').Goal[]} deps @returns {Goal} */
export const installGoal = (deps) =>
  goal("INSTALL", "Run augmentation suite", () => false, { deps, ownTime: () => 0 });

/** @param {number} hackReq @param {number} currentHacking @returns {Goal} */
export const hackingLevelGoal = (hackReq, currentHacking) =>
  goal("HACKING_LEVEL", `Hacking ≥ ${hackReq}`, () => currentHacking >= hackReq, { requirement: hackReq });

/** @param {number} combatReq @param {Skills} currentSkills @returns {Goal} */
export const combatLevelsGoal = (combatReq, currentSkills) =>
  goal("COMBAT_LEVELS", `Combat stats ≥ ${combatReq}`,
    () => COMBAT_STATS.every(stat => currentSkills[stat] >= combatReq),
    { requirement: combatReq });

/** @param {number} killsRequired @param {number} numPeopleKilled @returns {Goal} */
export const killsGoal = (killsRequired, numPeopleKilled) =>
  goal("KILLS", `Kill ${killsRequired} people`,
    () => numPeopleKilled >= killsRequired,
    { requirement: numPeopleKilled, ownTime: () => (killsRequired - numPeopleKilled) * 3 });

/** @param {number} karmaRequired @param {number} karma @returns {Goal} */
export const karmaGoal = (karmaRequired, karma) =>
  goal("KARMA", `Have ${karmaRequired} karma`,
    () => karmaRequired >= karma,
    { requirement: karmaRequired, ownTime: () => -(karmaRequired - karma) });

/** @param {number} moneyTarget @param {number} currentMoney @param {number} referenceIncome @returns {Goal} */
export const moneyPrereqGoal = (moneyTarget, currentMoney, referenceIncome) =>
  goal("MONEY", `Have ${fmtMoney(moneyTarget)}`,
    () => currentMoney >= moneyTarget,
    {
      requirement: moneyTarget,
      ownTime: () => referenceIncome > 0 ? Math.max(0, moneyTarget - currentMoney) / referenceIncome : null,
    });

/** @param {string} location @param {string} currentLocation @returns {Goal} */
export const locationGoal = (location, currentLocation) =>
  goal("LOCATION", "Visit " + location,
    () => currentLocation === location,
    { requirement: /** @type {any} */ (location), ownTime: () => 0 });

/** @param {string} faction @param {string[]} factions @param {Goal[]} [deps] @returns {Goal} */
export const factionJoinGoal = (faction, factions, deps = []) =>
  goal("FACTION_JOIN", "Join " + faction, () => factions.includes(faction), { deps, ownTime: () => 0 });

/**
 * @param {string} faction
 * @param {number} requirement
 * @param {Record<string,number>} factionRep
 * @param {Goal} dep
 * @param {Record<string,number>} activeRepRate
 * @param {Record<string,number>} passiveRepRate
 * @returns {Goal}
 */
export const factionRepGoal = (faction, requirement, factionRep, dep, activeRepRate, passiveRepRate) => {
  const currentRep = factionRep?.[faction] ?? 0;
  const rate = activeRepRate[faction] || passiveRepRate[faction] || 0;
  return goal("FACTION_REP", `Gain ${requirement} rep (${faction})`,
    () => currentRep >= requirement,
    {
      requirement, faction, deps: [dep],
      ownTime: () => rate > 0 ? Math.max(0, requirement - currentRep) / rate : null,
    });
};

/** @param {number | undefined} costToAug @param {number} currentMoney @param {number} estimatedStockValue @param {number} referenceIncome @returns {Goal} */
export const augMoneyGoal = (costToAug, currentMoney, estimatedStockValue, referenceIncome) => {
  const effectiveMoney = currentMoney + 0.9 * estimatedStockValue;
  return goal("AUG_MONEY",
    "Save " + (costToAug != null ? fmtMoney(costToAug) : "?") + " for augmentations",
    () => costToAug != null && effectiveMoney >= costToAug,
    {
      requirement: costToAug,
      ownTime: () => costToAug != null && referenceIncome > 0
        ? Math.max(0, costToAug - effectiveMoney) / referenceIncome
        : null,
    });
};

/** @param {string} aug @param {string} faction @param {string[]} purchasedAugmentations @param {Goal[]} deps @returns {Goal} */
export const augmentationGoal = (aug, faction, purchasedAugmentations, deps) =>
  goal("AUGMENTATION", aug,
    () => purchasedAugmentations.includes(aug),
    { faction, deps, ownTime: () => 0 });
