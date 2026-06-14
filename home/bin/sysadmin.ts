import { THREADPOOL } from '../etc/config';
import {
  getSchedulerReportData,
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
  getIncome,
} from '../lib/query-service';
import { getTimeToMilestone } from '../lib/goals/goals';
import { fullInfect } from './infect';

const serverNames = (maxServers: number) => {
  return new Array(maxServers)
    .fill(null)
    .map((_, i) => (i + 1).toString().padStart(2, '0'))
    .map((n) => `${THREADPOOL}-${n}`);
};

const getPurchasedServerRams = (ns: NS, maxServers: number) => {
  return serverNames(maxServers)
    .filter(ns.serverExists)
    .map((hostname) => ({
      hostname,
      ram: ns.getServerMaxRam(hostname),
    }));
};

const getNextServerName = (ns: NS, maxServers: number) =>
  serverNames(maxServers).find((hostname) => !ns.serverExists(hostname));

const atCapacity = (ns: NS) => {
  const rootHosts = getHostnames(ns).filter((hostname) =>
    ns.hasRootAccess(hostname),
  );
  const totalMaxRam = rootHosts
    .map(ns.getServerMaxRam)
    .reduce((a, b) => a + b, 0);
  const totalUsedRam = rootHosts
    .map(ns.getServerUsedRam)
    .reduce((a, b) => a + b, 0);
  const poolReserve = getSchedulerReportData(ns).poolReserve ?? 0;

  // Allow a 20% buffer; pool reserve counts as occupied since hackers leave it free.
  return totalUsedRam + poolReserve > totalMaxRam * 0.8;
};

export async function main(ns: NS) {
  ns.disableLog('ALL');

  const {
    requiredJobRam,
    requiredAugRam,
    purchasedServerLimit,
    purchasedServerCosts,
    purchasedServerMaxRam,
  } = getStaticData(ns);

  const buyServer = async (
    minRam: number,
    maxRam: number,
    hostname = getNextServerName(ns, purchasedServerLimit),
  ) => {
    if (hostname == null) {
      throw new Error('Attempted to buy server past limit');
    }

    const isUpgrade = ns.serverExists(hostname);
    const savings = isUpgrade
      ? ns.cloud.getServerCost(ns.getServerMaxRam(hostname))
      : 0;

    const purchase = isUpgrade
      ? (hostname: string, ram: number) => ns.cloud.upgradeServer(hostname, ram)
      : (hostname: string, ram: number) =>
          ns.cloud.purchaseServer(hostname, ram);

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

    if (!isUpgrade) {
      fullInfect(ns, hostname);
    }
  };

  const attemptPurchase = async (ns: NS) => {
    const { resetInfo } = getStaticData(ns);
    const { totalIncome, theftRatePerGB } = getIncome(ns);
    if (totalIncome == null) return;
    const timeToGoal = getTimeToMilestone(ns) ?? Infinity;
    // TODO: Make threshold time based on urgency of joining faction.
    // If goal tree is rep-bound, then the threshold time should be
    // based on join money rather than aug money so that the player
    // can join as sooner.
    const money = ns.getServerMoneyAvailable('home');
    if (resetInfo.currentNode === 8 && money < 1e9) return;

    const servers = getPurchasedServerRams(ns, purchasedServerLimit);
    const atMaxServers = servers.length === purchasedServerLimit;

    const profit = (ram: number) => {
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
        purchasedServerCosts[minRam] < totalIncome * 5
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
