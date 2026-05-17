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
  const { purchasedServerCosts, requiredJobRam } = getStaticData(ns);
  return purchasedServerCosts && { purchasedServerCosts, requiredJobRam };
});

export const getJobRamCost = cache((ns) => {
  const { purchasedServerCosts, requiredJobRam } = getRamInfo(ns);
  return purchasedServerCosts[requiredJobRam];
});

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
  const { rootServers, purchasedServers } = getRamData(ns);

  const homeRam = rootServers.find((/** @type {{hostname: string, maxRam: number}} */ s) => s.hostname === "home")?.maxRam ?? 0;
  const jobRam = purchasedServers[0]?.maxRam || 0;

  return homeRam < requiredJobRam * 2 && jobRam < requiredJobRam;
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

