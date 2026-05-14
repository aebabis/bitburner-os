import {
  // getHostnames,
  getStaticData,
  // getGangData,
  // getDataboardData,
  getRamData,
  getPlayerData,
  getMoneyData,
  getGoalsData,
  getGangData,
} from "./data-store";

/** @template T
 *  @param {(ns: NS) => T} func */
const cache = (func) => {
  /** @type {T | undefined} */
  let data;
  /** @param {NS} ns */
  return (ns) => {
    if (data === undefined) data = func(ns);
    return data;
  };
};

const getRamInfo = cache((ns) => {
  const { purchasedServerCosts, requiredJobRam } = getStaticData(ns);
  return purchasedServerCosts && { purchasedServerCosts, requiredJobRam };
});

export const getJobRamCost = cache((ns) => {
  const { purchasedServerCosts, requiredJobRam } = getRamInfo(ns);
  return purchasedServerCosts[requiredJobRam];
});

/** @param {NS} ns */
export const getTargetFaction = (ns) => {
  const { targetFaction, manualOverride } = getGoalsData(ns);
  if (manualOverride) return targetFaction;
  const { factionRep } = getPlayerData(ns);
  const gang = getGangData(ns)?.gangInfo?.faction;
  const gangRep = factionRep?.[gang] ?? 0;
  const targetFactionRep = factionRep?.[targetFaction] ?? 0;
  return gangRep > targetFactionRep ? gang : targetFaction;
};

/**
 * Returns all (faction, repRequired) pairs the player still needs to satisfy.
 * Handles the gang scenario where augs are split across two factions.
 * @param {NS} ns
 * @returns {{ faction: string, requirement: number, isGang: boolean }[]}
 */
export const getRepTargets = (ns) => {
  const staticData = getStaticData(ns);
  const { factionAugmentations = {}, augmentationRepReqs = {} } = staticData;
  const goalsData = getGoalsData(ns);
  const targetAugmentations = goalsData.targetAugmentations ?? staticData.targetAugmentations;
  if (targetAugmentations == null) return [];

  const effectiveFaction = getTargetFaction(ns);
  const originalFaction = goalsData.targetFaction ?? staticData.targetFaction;
  const gangFaction = getGangData(ns)?.gangInfo?.faction;
  const isGangTarget = effectiveFaction === gangFaction && gangFaction !== originalFaction;

  const maxRep = (/** @type {string[]} */ augs) =>
    Math.max(...augs.map((/** @type {string} */ aug) => augmentationRepReqs[aug] ?? 0), 0);

  if (isGangTarget) {
    const gangAugs = /** @type {string[]} */ (factionAugmentations[gangFaction] ?? []);
    const gangTargetAugs = targetAugmentations.filter((/** @type {string} */ aug) => gangAugs.includes(aug));
    const factionOnlyAugs = targetAugmentations.filter((/** @type {string} */ aug) => !gangAugs.includes(aug));
    const targets = [];
    if (gangTargetAugs.length > 0)
      targets.push({ faction: gangFaction, requirement: maxRep(gangTargetAugs), isGang: true });
    if (factionOnlyAugs.length > 0)
      targets.push({ faction: originalFaction, requirement: maxRep(factionOnlyAugs), isGang: false });
    return targets;
  } else {
    const repNeeded = getRepNeeded(ns);
    return repNeeded != null ? [{ faction: effectiveFaction, requirement: repNeeded, isGang: false }] : [];
  }
};

/** @param {NS} ns */
const getMoneyTime = (ns) => {
  const { factions=[] } = getPlayerData(ns);
  const repTargets = getRepTargets(ns);
  const nonGangTarget = repTargets.find((target) => !target.isGang);
  if (nonGangTarget && !factions.includes(nonGangTarget.faction)) {
    const { factionRequirements } = getStaticData(ns);
    const requirements = factionRequirements?.[nonGangTarget.faction];
    const moneyTarget = requirements?.find((req) => req.type === 'money')?.money;
    if (moneyTarget) {
      const { money, referenceIncome } = getMoneyData(ns);
      const moneyStillNeeded = moneyTarget - money;
      return Math.max(0, moneyStillNeeded / referenceIncome);
    }
  }
  const {
    money,
    referenceIncome,
    costToAug,
    estimatedStockValue: stock = 0,
  } = getMoneyData(ns);
  if (costToAug == null) {
    return DAY;
  }
  const moneyStillNeeded = costToAug - money - stock;
  return Math.max(0, moneyStillNeeded / referenceIncome);
};

/** @param {NS} ns */
const getRepTime = (ns) => {
  const { player, factionRep, activeRepRate = {}, passiveRepRate = {} } = getPlayerData(ns);
  const targets = getRepTargets(ns).filter((target) => (
    player.factions.includes(target.faction)
  ));
  if (targets.length === 0) return 0;
  // Because activeRepRate includes passiveRepRate implicitly with no
  // known way to separate the two, we only use active when possible
  return Math.max(0, ...targets.map(({ faction, requirement }) => {
    const remaining = requirement - (factionRep?.[faction] ?? 0);
    const rate = activeRepRate[faction] || passiveRepRate[faction] || 0.1;
    return remaining / rate;
  }));
};

const DAY = 60 * 60 * 24;
/** @param {NS} ns */
export const getTimeEstimates = (ns) => ({
  moneyTime: getMoneyTime(ns),
  repTime: getRepTime(ns),
});

/** @param {NS} ns */
const estimateTimeToAug = (ns) => {
  const { moneyTime, repTime } = getTimeEstimates(ns);
  return Math.max(moneyTime, repTime);
};

/** @param {NS} ns */
export const isMoneyBound = (ns) => {
  const { moneyTime, repTime } = getTimeEstimates(ns);
  return moneyTime > repTime;
};

/** @param {NS} ns */
export const isRepBound = (ns) => {
  const { moneyTime, repTime } = getTimeEstimates(ns);
  return repTime > moneyTime;
};

/** @param {NS} ns */
export const needsJobRam = (ns) => {
  const { requiredJobRam } = getRamInfo(ns);
  const { rootServers, purchasedServers } = getRamData(ns);

  const homeRam = rootServers.find((/** @type {{hostname: string, maxRam: number}} */ s) => s.hostname === "home")?.maxRam ?? 0;
  const jobRam = purchasedServers[0]?.maxRam || 0;

  return homeRam < requiredJobRam * 2 && jobRam < requiredJobRam;
};

/** @param {NS} ns */
export const estimateTimeToGoal = (ns) => {
  if (needsJobRam(ns)) {
    const jobRamCost = getJobRamCost(ns);
    const { money, referenceIncome } = getMoneyData(ns);
    return (jobRamCost - money) / referenceIncome;
  } else {
    return estimateTimeToAug(ns);
  }
};

/** @param {NS} ns */
export const getGoalCost = (ns) =>
  getMoneyData(ns).costToAug || getJobRamCost(ns);

/** @param {NS} ns */
const getRepNeeded = (ns) => {
  const staticData = getStaticData(ns);
  const { augmentationRepReqs } = staticData;
  const goalsData = getGoalsData(ns);
  const targetAugmentations = goalsData.targetAugmentations ?? staticData.targetAugmentations;
  if (targetAugmentations == null) return null;
  const repCosts = targetAugmentations.map((/** @type {string} */ aug) => augmentationRepReqs[aug]);
  return Math.max(...repCosts, 0);
};

/** @param {NS} ns */
export const shouldWorkHaveFocus = (ns) => {
  const { isPlayerActive } = getPlayerData(ns);
  const { ownedAugmentations } = getStaticData(ns);
  if (ownedAugmentations == null) return !isPlayerActive;
  if (ownedAugmentations.includes("Neuroreceptor Management Implant"))
    return false;
  return !isPlayerActive;
};

/** @param {NS} ns
 *  @param {number} bn */
export const hasBitNode = (ns, bn) => {
  const { resetInfo, ownedSourceFiles } = getStaticData(ns);
  const inBN = resetInfo.currentNode === bn;
  const beatBN = ownedSourceFiles.find((/** @type {{n: number}} */ file) => file.n === bn);
  return inBN || beatBN;
};

