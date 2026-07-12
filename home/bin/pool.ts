import { getPlayerData, putMoneyData } from '../lib/data-store';
import { getGoals, isRepBound } from '../lib/goals/goals';

type HashrateUpgrade = {
  type: 'level' | 'ram' | 'cores';
  cost: number;
  utility: number;
};

const hashGainRate = (ns: NS) => (stats: NodeStats) =>
  ns.formulas.hacknetServers.hashGainRate(stats.level, stats.ramUsed ?? 0, stats.ram, stats.cores);

const upgrade =
  (ns: NS) => (i: number, type: HashrateUpgrade['type'], cost: number, currentStats: NodeStats) => {
    const newStats = { ...currentStats };
    if (type === 'ram') newStats.ram *= 2;
    else newStats[type] += 1;
    const hashrateGain = hashGainRate(ns)(newStats) - hashGainRate(ns)(currentStats);
    const utility = hashrateGain / cost;
    const breakEvenTime = cost / ((hashrateGain / 4) * 1e6);
    return { i, type, cost, hashrateGain, utility, breakEvenTime };
  };

const getNextUpgrade = (ns: NS) => {
  const nodes = new Array(ns.hacknet.numNodes())
    .fill(0)
    .map((_, i) => i)
    .map(ns.hacknet.getNodeStats);
  if (nodes.length === 0) return null;
  return nodes
    .flatMap((server, i) => [
      upgrade(ns)(i, 'level', ns.hacknet.getLevelUpgradeCost(i), server),
      upgrade(ns)(i, 'ram', ns.hacknet.getRamUpgradeCost(i), server),
      upgrade(ns)(i, 'cores', ns.hacknet.getCoreUpgradeCost(i), server),
    ])
    .reduce((a, b) => (a.utility > b.utility ? a : b));
};

const getNextNodeCost = (ns: NS, mults: Multipliers) => {
  const numNodes = ns.hacknet.numNodes();
  return ns.formulas.hacknetServers.hacknetServerCost(
    numNodes + 1,
    mults.hacknet_node_purchase_cost,
  );
};

const upgradeHacknetServers = (ns: NS, ttc: number | null) => {
  const numNodes = ns.hacknet.numNodes();
  if (numNodes === 0 && ns.hacknet.purchaseNode() === -1) {
    return;
  }
  while (true) {
    const { player } = getPlayerData(ns);
    const money = ns.getServerMoneyAvailable('home');
    const upgrade = getNextUpgrade(ns);
    const nodeCost = getNextNodeCost(ns, player.mults);
    ns.print(upgrade);
    if (upgrade == null) return;
    if (upgrade.cost > money) return;
    if (ttc != null && upgrade.breakEvenTime > ttc) return;
    if (nodeCost < upgrade.cost) {
      ns.hacknet.purchaseNode();
    } else {
      if (upgrade.type === 'level') ns.hacknet.upgradeLevel(upgrade.i);
      if (upgrade.type === 'ram') ns.hacknet.upgradeRam(upgrade.i);
      if (upgrade.type === 'cores') ns.hacknet.upgradeCore(upgrade.i);
    }
  }
};

export async function main(ns: NS) {
  ns.ui.openTail();

  let totalEarnings = 0;

  while (true) {
    ns.clearLog();
    const goals = getGoals(ns);
    const ttc = goals.timeToComplete();
    if (isRepBound(ns, goals)) {
      while (ns.hacknet.spendHashes('Improve Studying'));
    } else {
      // getRunningScript doesn't seem to track this
      while (ns.hacknet.spendHashes('Sell for Money')) totalEarnings += 1e6;
    }
    const { onlineRunningTime, offlineRunningTime } = ns.getRunningScript()!;
    const hacknetIncome = totalEarnings / (onlineRunningTime + offlineRunningTime);
    putMoneyData(ns, { hacknetIncome });

    if (ns.fileExists('Formulas.exe', 'home')) {
      upgradeHacknetServers(ns, ttc);
    }

    await ns.sleep(1000);
  }
}
