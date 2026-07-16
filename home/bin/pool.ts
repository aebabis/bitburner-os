import { getPlayerData, putMoneyData, putPlayerData } from '../lib/data-store';
import { getGoals } from '../lib/goals/goals';

type HashrateUpgrade = {
  type: 'level' | 'ram' | 'cores';
  cost: number;
  utility: number;
};

const hashGainRate = (ns: NS) => (stats: NodeStats) =>
  ns.formulas.hacknetServers.hashGainRate(stats.level, stats.ramUsed ?? 0, stats.ram, stats.cores);

const getNodes = (ns: NS) =>
  new Array(ns.hacknet.numNodes())
    .fill(0)
    .map((_, i) => i)
    .map(ns.hacknet.getNodeStats);

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
  const nodes = getNodes(ns);
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

const getUpgradeDetails = (ns: NS, upgrade: HacknetServerHashUpgrade) => {
  const currentLevel = ns.hacknet.getHashUpgradeLevel(upgrade);
  const cost = ns.formulas.hacknetServers.hashUpgradeCost(upgrade, currentLevel + 1);
  return { upgrade, currentLevel, cost };
};

const getTargetUpgrade = (ns: NS) => {
  const currentWork = ns.singularity.getCurrentWork();
  const gymTypes = Object.values(ns.enums.GymType) as string[];
  const uniTypes = Object.values(ns.enums.UniversityClassType) as string[];
  if (currentWork?.type === 'CLASS' && gymTypes.includes(currentWork.classType)) {
    return getUpgradeDetails(ns, 'Improve Gym Training');
  } else if (currentWork?.type === 'CLASS' && uniTypes.includes(currentWork.classType)) {
    return getUpgradeDetails(ns, 'Improve Studying');
  } else {
    return getUpgradeDetails(ns, 'Sell for Money');
  }
};

const getHashCapacityUpgrade = (ns: NS, ttc: number) => {
  const nodes = getNodes(ns);
  const totalHashGain = nodes.map(hashGainRate(ns)).reduce((a, b) => a + b, 0);
  const maxHashCapNeeded = ttc * totalHashGain;
  const candidates = nodes
    .map((node, i) => ({ i, node, cost: ns.hacknet.getCacheUpgradeCost(i) }))
    .filter(({ node }) => node.hashCapacity! < maxHashCapNeeded);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a.cost < b.cost ? a : b));
};

export async function main(ns: NS) {
  ns.ui.openTail();

  let totalEarnings = 0;

  while (true) {
    ns.clearLog();
    const goals = getGoals(ns);
    const ttc = goals.timeToComplete() || Infinity;
    const { upgrade, cost } = getTargetUpgrade(ns);
    if (cost > ns.hacknet.hashCapacity()) {
      const upgradedNeeded = getHashCapacityUpgrade(ns, ttc);
      if (upgradedNeeded) {
        while (
          upgradedNeeded.cost > ns.getServerMoneyAvailable('home') &&
          ns.hacknet.spendHashes('Sell for Money')
        )
          totalEarnings += 1e6;
        ns.hacknet.upgradeCache(upgradedNeeded.i);
      }
    }
    while (ns.hacknet.spendHashes(upgrade)) {
      if (upgrade === 'Sell for Money') totalEarnings += 1e6;
    }
    const { onlineRunningTime, offlineRunningTime } = ns.getRunningScript()!;
    const hacknetIncome = totalEarnings / (onlineRunningTime + offlineRunningTime);
    putMoneyData(ns, { hacknetIncome });
    putPlayerData(ns, {
      studyMult: ns.hacknet.getStudyMult(),
      trainingMult: ns.hacknet.getTrainingMult(),
    });

    if (ns.fileExists('Formulas.exe', 'home')) {
      upgradeHacknetServers(ns, ttc);
    }

    await ns.sleep(1000);
  }
}
