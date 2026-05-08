import { THREADPOOL } from "../etc/config";
import {
  getRamData,
  getMoneyData,
  getStaticData,
  getHostnames,
  putHostnames,
} from "../lib/data-store";
import { disableService } from "../lib/service-api";
import {
  estimateTimeToGoal,
  needsJobRam,
  getJobRamCost,
} from "../lib/query-service";
import { infect, fullInfect } from "./infect";

/** @param {number} maxServers */
const getServerNames = (maxServers) => {
  return new Array(maxServers)
    .fill(null)
    .map((_, i) => (i + 1).toString().padStart(2, "0"))
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

/** @param {NS} ns @param {string} hostname */
const deleteServer = (ns, hostname) => {
  ns.killall(hostname);
  ns.deleteServer(hostname);
};

/** @param {NS} ns @param {string} hostname @param {number} minRam @param {number} maxRam */
const purchaseServer = (ns, hostname, minRam, maxRam) => {
  let ram = maxRam;
  while (!ns.purchaseServer(hostname, ram)) {
    ram /= 2;
    if (ram < minRam) return false;
  }
  return ram;
};

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  const {
    requiredJobRam,
    purchasedServerLimit,
    purchasedServerCosts,
    purchasedServerMaxRam,
  } = getStaticData(ns);

  const buyServer = async (
    /** @type {number} */ minRam,
    /** @type {number} */ maxRam,
    /** @type {string} */ hostname = /** @type {string} */ (getNextServerName(ns, purchasedServerLimit)),
  ) => {
    const JOB_SERVERS = [`${THREADPOOL}-01`, `${THREADPOOL}-02`];

    const isUpgrade = ns.serverExists(hostname);
    const isJobServer = JOB_SERVERS.includes(hostname);

    if (isUpgrade) deleteServer(ns, hostname);

    const ram = purchaseServer(ns, hostname, minRam, maxRam);
    const oldHostnames = getHostnames(ns);
    const newHostnames = new Set(oldHostnames).add(hostname);
    putHostnames(ns, [...newHostnames]);

    if (!ram) {
      // Rare. Seems to happen if a duplicate purchase is made,
      // messing up the server names.
      ns.print(`ERROR - Failed to purchase ${minRam}GB ram on ${hostname}`);
      return;
    }

    const cost = ns.formatNumber(ns.getPurchasedServerCost(ram), 3);

    if (isUpgrade) ns.print(`Upgraded ${hostname} to ${ram}GB ram for ${cost}`);
    else ns.print(`Purchased ${hostname} with ${ram}GB ram for ${cost}`);

    if (isJobServer) await fullInfect(ns, hostname);
    else await infect(ns, hostname);
  };

  const getSmallestServer = (/** @type {{hostname: string, ram: number}[]} */ servers) => {
    if (servers.length === 0) return null;
    if (servers.length === 1) return servers[0];
    return servers.reduce((/** @type {{hostname: string, ram: number}} */ s1, /** @type {{hostname: string, ram: number}} */ s2) => (s1.ram <= s2.ram ? s1 : s2));
  };

  const attemptPurchase = async (/** @type {NS} */ ns) => {
    const { income, theftRatePerGB } = getMoneyData(ns);
    const timeToGoal = estimateTimeToGoal(ns);
    const money = ns.getServerMoneyAvailable("home");

    const servers = getPurchasedServerRams(ns, purchasedServerLimit);
    const atMaxServers = servers.length === purchasedServerLimit;
    const smallest = getSmallestServer(servers);

    const profit = (/** @type {number} */ ram) => {
      const newRam = ram - (smallest?.ram || 0);
      const ramProfit = timeToGoal * theftRatePerGB * newRam;
      return ramProfit - purchasedServerCosts[ram];
    };

    const getMinRam = () => {
      let minRam = !atMaxServers ? 4 : /** @type {{hostname: string, ram: number}} */ (smallest).ram * 2;
      while (profit(minRam) < 0) {
        minRam *= 2;
        if (minRam > purchasedServerMaxRam) return null;
      }
      while (
        minRam < purchasedServerMaxRam &&
        purchasedServerCosts[minRam] < income * 5
      )
        minRam *= 2;
      return minRam;
    };

    if (
      atMaxServers &&
      servers.every((server) => server.ram === purchasedServerMaxRam)
    ) {
      disableService(ns, "sysadmin");
      return;
    }

    if (needsJobRam(ns)) {
      if (getJobRamCost(ns) <= money)
        await buyServer(requiredJobRam, requiredJobRam, `${THREADPOOL}-01`);
      return;
    }

    const minRam = getMinRam();
    const maxRam = Math.min(purchasedServerMaxRam, /** @type {number} */ (minRam) * 4);

    if (minRam == null) {
      ns.print("Not purchasing server because estimated time of goal too soon");
      await ns.sleep(10000);
      return;
    }

    if (money < purchasedServerCosts[minRam]) return;

    if (servers.length > 0 && !atCapacity(ns)) return;

    if (!atMaxServers) await buyServer(minRam, maxRam);
    else await buyServer(minRam, maxRam, /** @type {{hostname: string, ram: number}} */ (smallest).hostname);
  };

  while (true) {
    await attemptPurchase(ns);
    await ns.sleep(50);
  }
}
