import {
  // getHostnames,
  getStaticData,
  // getGangData,
  // getDataboardData,
  getRamData,
  getPlayerData,
  getMoneyData,
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

const DAY = 60 * 60 * 24;
/** @param {NS} ns */
export const getTimeEstimates = (ns) => {
  const {
    money,
    income,
    costToAug,
    estimatedStockValue: stock = 0,
  } = getMoneyData(ns);
  const {
    factionRep,
    activeRepRate = {},
    passiveRepRate = {},
  } = getPlayerData(ns);
  const { targetFaction } = getStaticData(ns);

  const moneyTime =
    costToAug != null ? (costToAug - money - stock) / income : DAY;
  // Because activeRepRate includes passiveRepRate implicitly with no
  // known way to separate the two, we only use active when possible
  const repRate =
    activeRepRate[targetFaction] || passiveRepRate[targetFaction] || 0.1;
  const repAcquired = factionRep != null ? factionRep[targetFaction] : 0;

  const repRemaining = (getRepNeeded(ns) ?? 0) - repAcquired;
  const repTime = repRemaining / repRate;

  return { moneyTime, repTime };
};

/** @param {NS} ns */
export const estimateTimeToAug = (ns) => {
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
    const { money, income } = getMoneyData(ns);
    return (jobRamCost - money) / income;
  } else {
    return estimateTimeToAug(ns);
  }
};

/** @param {NS} ns */
export const getGoalCost = (ns) =>
  getMoneyData(ns).costToAug || getJobRamCost(ns);

/** @param {NS} ns */
export const getRepNeeded = (ns) => {
  const { targetAugmentations, augmentationRepReqs } = getStaticData(ns);
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

/** @param {NS} ns **/
const queryService = (ns) => {
  return {
    estimateTimeToAug: () => estimateTimeToAug(ns),
  };
};

/** @param {NS} ns **/
export async function main(ns) {
  const [func] = ns.args;
  ns.tprint(queryService(ns)[/** @type {keyof ReturnType<typeof queryService>} */ (func)]());
}

export default queryService;
