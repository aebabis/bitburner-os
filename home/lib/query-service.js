import { getStaticData, getRamData, getPlayerData } from './data-store';

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
  const { purchasedServerCosts, requiredJobRam, requiredAugRam } =
    getStaticData(ns);
  return (
    purchasedServerCosts && {
      purchasedServerCosts,
      requiredJobRam,
      requiredAugRam,
    }
  );
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
  const homeRam =
    rootServers.find(
      (/** @type {{hostname: string, maxRam: number}} */ s) =>
        s.hostname === 'home',
    )?.maxRam ?? 0;
  const pool1Ram = purchasedServers[0]?.maxRam || 0;
  return { homeRam, pool1Ram };
};

/** @param {NS} ns */
export const needsJobRam = (ns) => {
  const { requiredJobRam } = getStaticData(ns);
  const { homeRam, pool1Ram } = getPoolRamStatus(ns);
  return homeRam < requiredJobRam * 2 && pool1Ram < requiredJobRam;
};

/** @param {NS} ns */
export const needsAugRam = (ns) => {
  const { requiredAugRam } = getStaticData(ns);
  const { homeRam, pool1Ram } = getPoolRamStatus(ns);
  return homeRam < requiredAugRam * 2 && pool1Ram < requiredAugRam;
};

/** @param {NS} ns */
export const shouldWorkHaveFocus = (ns) => {
  const { isPlayerActive } = getPlayerData(ns);
  const { installedAugmentations } = getStaticData(ns);
  if (installedAugmentations.includes('Neuroreceptor Management Implant'))
    return false;
  return !isPlayerActive;
};

/** @param {NS} ns
 *  @param {number} bn */
export const hasBitNode = (ns, bn) => {
  const { resetInfo } = getStaticData(ns);
  return resetInfo.currentNode === bn || resetInfo.ownedSF.has(bn);
};
