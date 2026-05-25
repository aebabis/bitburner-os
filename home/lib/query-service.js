import {
  // getHostnames,
  getStaticData,
  // getGangData,
  // getDataboardData,
  getRamData,
  getPlayerData,
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
  const { purchasedServerCosts, requiredJobRam, requiredAugRam } = getStaticData(ns);
  return purchasedServerCosts && { purchasedServerCosts, requiredJobRam, requiredAugRam };
});

export const getJobRamCost = cache((ns) => {
  const { purchasedServerCosts, requiredJobRam } = getRamInfo(ns);
  return purchasedServerCosts[requiredJobRam];
});

export const getAugRamCost = cache((ns) => {
  const { purchasedServerCosts, requiredAugRam } = getRamInfo(ns);
  return purchasedServerCosts[requiredAugRam];
});

const getPoolRamStatus = (ns) => {
  const { rootServers, purchasedServers } = getRamData(ns);
  const homeRam = rootServers.find((/** @type {{hostname: string, maxRam: number}} */ s) => s.hostname === "home")?.maxRam ?? 0;
  const pool1Ram = purchasedServers[0]?.maxRam || 0;
  return { homeRam, pool1Ram };
};

/** @param {NS} ns */
const getTargetFaction = (ns) => {
  const { targetFaction, manualOverride } = getGoalsData(ns);
  if (manualOverride) return targetFaction;
  const { factionRep } = getPlayerData(ns);
  const gang = getGangData(ns)?.gangInfo?.faction;
  const gangRep = factionRep?.[gang] ?? 0;
  const targetFactionRep = factionRep?.[targetFaction] ?? 0;
  return gangRep > targetFactionRep ? gang : targetFaction;
};

/** @param {NS} ns */
export const needsJobRam = (ns) => {
  const { requiredJobRam } = getRamInfo(ns);
  const { homeRam, pool1Ram } = getPoolRamStatus(ns);
  return homeRam < requiredJobRam * 2 && pool1Ram < requiredJobRam;
};

/** @param {NS} ns */
export const needsAugRam = (ns) => {
  const { requiredAugRam } = getRamInfo(ns);
  const { homeRam, pool1Ram } = getPoolRamStatus(ns);
  return homeRam < requiredAugRam * 2 && pool1Ram < requiredAugRam;
};

/** @param {NS} ns */
export const shouldWorkHaveFocus = (ns) => {
  const { isPlayerActive } = getPlayerData(ns);
  const { installedAugmentations } = getStaticData(ns);
  if (installedAugmentations.includes("Neuroreceptor Management Implant"))
    return false;
  return !isPlayerActive;
};

/** @param {NS} ns
 *  @param {number} bn */
export const hasBitNode = (ns, bn) => {
  const { resetInfo } = getStaticData(ns);
  return resetInfo.currentNode === bn || resetInfo.ownedSF.has(bn);
};

