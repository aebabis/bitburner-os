import { THREADPOOL } from '../etc/config';
import {
  getRamData,
  getMoneyData,
  getStaticData,
  getHostnames,
  putHostnames,
} from '../lib/data-store';
import { disableService } from '../lib/service-api';
import {
  needsJobRam,
  needsAugRam,
  getJobRamCost,
  getAugRamCost,
} from '../lib/query-service';
import { getTimeToComplete } from '../lib/goals/goals';
import { infect, fullInfect } from './infect';

/** @param {number} maxServers */
const getServerNames = (maxServers) => {
  return new Array(maxServers)
    .fill(null)
    .map((_, i) => (i + 1).toString().padStart(2, '0'))
    .map((n) => `${THREADPOOL}-${n}`);
};

/** @param {NS} ns @param {number} maxServers */
const getPurchasedServerRams = (ns, maxServers) => {
  return getServerNames(maxServers)
    .filter(ns.serverExists)
    .map((hostname) => ({
      hostname,
      ram: ns.getServerMaxRam(hostname),
    }));
};

/** @param {NS} ns @param {number} maxServers */
const getNextServerName = (ns, maxServers) =>
  getServerNames(maxServers).find((hostname) => !ns.serverExists(hostname));

/** @param {NS} ns **/
const atCapacity = (ns) => {
  const ramData = getRamData(ns);
  if (ramData == null) return false;

  const { totalRamUsed, totalMaxRam, ramQueued } = ramData;

  // Allow a 20% buffer
  return totalRamUsed + ramQueued > totalMaxRam * 0.8;
};

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog('ALL');

  const {
    requiredJobRam,
    requiredAugRam,
    purchasedServerLimit,
    purchasedServerCosts,
    purchasedServerMaxRam,
  } = getStaticData(ns);

  const buyServer = async (
    /** @type {number} */ minRam,
    /** @type {number} */ maxRam,
    /** @type {string} */ hostname = /** @type {string} */ getNextServerName(
      ns,
      purchasedServerLimit,
    ),
  ) => {
    const JOB_SERVERS = [`${THREADPOOL}-01`, `${THREADPOOL}-02`];

    const isUpgrade = ns.serverExists(hostname);
    const isJobServer = JOB_SERVERS.includes(hostname);
    const savings = isUpgrade
      ? ns.cloud.getServerCost(ns.getServerMaxRam(hostname))
      : 0;

    const purchase = isUpgrade
      ? /** @param {string} hostname @param {number} ram */
        (hostname, ram) => ns.cloud.upgradeServer(hostname, ram)
      : /** @param {string} hostname @param {number} ram */
        (hostname, ram) => ns.cloud.purchaseServer(hostname, ram);

    let ram = maxRam;
    while (!purchase(hostname, ram)) {
      ram /= 2;
      if (ram < minRam) {
        // Rare. Seems to happen if a duplicate purchase is made,
        // messing up the server names.
        ns.print(`ERROR - Failed to purchase ${minRam}GB ram on ${hostname}`);
        return;
      }
    }

    const oldHostnames = getHostnames(ns);
    const newHostnames = new Set(oldHostnames).add(hostname);
    putHostnames(ns, [...newHostnames]);

    const cost = ns.format.number(ns.cloud.getServerCost(ram) - savings, 3);

    if (isUpgrade) ns.print(`Upgraded ${hostname} to ${ram}GB ram for ${cost}`);
    else ns.print(`Purchased ${hostname} with ${ram}GB ram for ${cost}`);

    if (isJobServer) fullInfect(ns, hostname);
    else infect(ns, hostname);
  };

  const attemptPurchase = async (/** @type {NS} */ ns) => {
    const { referenceIncome, theftRatePerGB } = getMoneyData(ns);
    if (referenceIncome == null) return;
    const timeToGoal = getTimeToComplete(ns) ?? Infinity;
    // TODO: Make threshold time based on urgency of joining faction.
    // If goal tree is rep-bound, then the threshold time should be
    // based on join money rather than aug money so that the player
    // can join as sooner.
    const money = ns.getServerMoneyAvailable('home');

    const servers = getPurchasedServerRams(ns, purchasedServerLimit);
    const atMaxServers = servers.length === purchasedServerLimit;

    const profit = (/** @type {number} */ ram) => {
      const ramProfit = timeToGoal * theftRatePerGB * ram;
      return ramProfit - purchasedServerCosts[ram];
    };

    const getMinRam = () => {
      let minRam = 4;
      while (profit(minRam) < 0) {
        minRam *= 2;
        if (minRam > purchasedServerMaxRam) return null;
      }
      while (
        minRam < purchasedServerMaxRam &&
        purchasedServerCosts[minRam] < referenceIncome * 5
      )
        minRam *= 2;
      return minRam;
    };

    if (
      atMaxServers &&
      servers.every((server) => server.ram === purchasedServerMaxRam)
    ) {
      disableService(ns, 'sysadmin');
      return;
    }

    if (needsJobRam(ns) && getJobRamCost(ns) <= money) {
      await buyServer(requiredJobRam, requiredJobRam, `${THREADPOOL}-01`);
      return;
    }
    if (needsAugRam(ns) && getAugRamCost(ns) <= money) {
      await buyServer(requiredAugRam, requiredAugRam, `${THREADPOOL}-01`);
      return;
    }

    const minRam = getMinRam();

    if (minRam == null) {
      ns.print('Not purchasing server because estimated time of goal too soon');
      await ns.sleep(10000);
      return;
    }

    const maxRam = Math.min(purchasedServerMaxRam, minRam * 4);

    if (money < purchasedServerCosts[minRam]) return;

    if (servers.length > 0 && !atCapacity(ns)) return;

    // Prefer upgrading the lowest-numbered server that hasn't yet reached minRam
    const upgradeTarget = servers.find(({ ram }) => ram < minRam) ?? null;
    if (upgradeTarget != null)
      await buyServer(minRam, maxRam, upgradeTarget.hostname);
    else if (!atMaxServers) await buyServer(minRam, maxRam);
  };

  while (true) {
    await attemptPurchase(ns);
    await ns.sleep(50);
  }
}
