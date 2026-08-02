import { getPlayerData, HacknetPurchase, putMoneyData, putPlayerData } from '../lib/data-store';
import { getGoals } from '../lib/goals/goals';
import { Goal } from '../lib/goals/nodes';

const hashGainRate = (ns: NS) => (stats: NodeStats) =>
  ns.formulas.hacknetServers.hashGainRate(stats.level, stats.ramUsed ?? 0, stats.ram, stats.cores);

const getNodes = (ns: NS) =>
  new Array(ns.hacknet.numNodes())
    .fill(0)
    .map((_, i) => i)
    .map(ns.hacknet.getNodeStats);

const upgrade =
  (ns: NS) =>
  (
    i: number,
    type: 'level' | 'ram' | 'cores',
    cost: number,
    currentStats: NodeStats,
  ): HacknetPurchase => {
    const newStats = { ...currentStats };
    if (type === 'ram') newStats.ram *= 2;
    else newStats[type] += 1;
    const hashrateGain = hashGainRate(ns)(newStats) - hashGainRate(ns)(currentStats);
    const utility = hashrateGain / cost;
    const breakEvenTime = cost / ((hashrateGain / 4) * 1e6);
    return { i, type, cost, hashrateGain, utility, breakEvenTime };
  };

const getNextNodeCost = (ns: NS, mults: Multipliers) => {
  const numNodes = ns.hacknet.numNodes();
  return ns.formulas.hacknetServers.hacknetServerCost(
    numNodes + 1,
    mults.hacknet_node_purchase_cost,
  );
};

const newNodeUpgrade = (ns: NS, mults: Multipliers): HacknetPurchase => {
  const cost = getNextNodeCost(ns, mults);
  const hashrateGain = ns.formulas.hacknetServers.hashGainRate(1, 0, 1, 1);
  const utility = hashrateGain / cost;
  const breakEvenTime = cost / ((hashrateGain / 4) * 1e6);
  return { i: -1, type: 'node' as const, cost, hashrateGain, utility, breakEvenTime };
};

const getNextUpgrade = (ns: NS, mults: Multipliers) => {
  const nodes = getNodes(ns);
  const candidates = [
    ...nodes.flatMap((server, i) => [
      upgrade(ns)(i, 'level', ns.hacknet.getLevelUpgradeCost(i), server),
      upgrade(ns)(i, 'ram', ns.hacknet.getRamUpgradeCost(i), server),
      upgrade(ns)(i, 'cores', ns.hacknet.getCoreUpgradeCost(i), server),
    ]),
    newNodeUpgrade(ns, mults),
  ];
  return candidates.reduce((a, b) => (a.utility > b.utility ? a : b));
};

const upgradeHacknetServers = (ns: NS, ttc: number | null) => {
  const goals = getGoals(ns);
  const openHacknetGoals = goals.prerequisites('HACKNET').filter((goal) => !goal.isDone());
  const numNodes = ns.hacknet.numNodes();
  if (numNodes === 0 && ns.hacknet.purchaseNode() === -1) {
    return null;
  }
  while (true) {
    const { player } = getPlayerData(ns);
    const money = ns.getServerMoneyAvailable('home');
    const upgrade = getNextUpgrade(ns, player.mults);
    if (upgrade.cost > money) return upgrade;
    if (ttc != null && upgrade.breakEvenTime > ttc && openHacknetGoals.length === 0) {
      return upgrade;
    }
    if (upgrade.type === 'node') ns.hacknet.purchaseNode();
    if (upgrade.type === 'level') ns.hacknet.upgradeLevel(upgrade.i);
    if (upgrade.type === 'ram') ns.hacknet.upgradeRam(upgrade.i);
    if (upgrade.type === 'cores') ns.hacknet.upgradeCore(upgrade.i);
  }
};

const getUpgradeDetails = (ns: NS, upgrade: HacknetServerHashUpgrade) => {
  const currentLevel = ns.hacknet.getHashUpgradeLevel(upgrade);
  const cost = ns.formulas.hacknetServers.hashUpgradeCost(upgrade, currentLevel + 1);
  return { upgrade, currentLevel, cost };
};

const getTargetUpgrade = (ns: NS, goals: Goal) => {
  const currentWork = ns.singularity.getCurrentWork();
  const gymTypes = Object.values(ns.enums.GymType) as string[];
  const uniTypes = Object.values(ns.enums.UniversityClassType) as string[];
  const moneyGoal = goals.prerequisites('AUG_MONEY')[0];
  if (currentWork?.type === 'CLASS' && gymTypes.includes(currentWork.classType)) {
    return getUpgradeDetails(ns, 'Improve Gym Training');
  } else if (currentWork?.type === 'CLASS' && uniTypes.includes(currentWork.classType)) {
    return getUpgradeDetails(ns, 'Improve Studying');
  } else if (ns.corporation.hasCorporation() && (moneyGoal?.isDone() ?? true)) {
    const corpFundsUpgrade = getUpgradeDetails(ns, 'Sell for Corporation Funds');
    const corpResearchUpgrade = getUpgradeDetails(ns, 'Exchange for Corporation Research');
    return corpFundsUpgrade.cost < corpResearchUpgrade.cost
      ? corpFundsUpgrade
      : corpResearchUpgrade;
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
  while (true) {
    ns.clearLog();
    const goals = getGoals(ns);
    const ttc = goals.timeToComplete() ?? Infinity;
    const { upgrade, cost } = getTargetUpgrade(ns, goals);
    const getMoney = () => ns.getServerMoneyAvailable('home');
    if (cost > ns.hacknet.hashCapacity()) {
      const upgradedNeeded = getHashCapacityUpgrade(ns, ttc);
      if (upgradedNeeded) {
        while (upgradedNeeded.cost > getMoney() && ns.hacknet.spendHashes('Sell for Money'));
        ns.hacknet.upgradeCache(upgradedNeeded.i);
      }
    }
    while (ns.hacknet.spendHashes(upgrade));

    const nextPurchase = upgradeHacknetServers(ns, ttc);

    const nodes = getNodes(ns);
    const hashRate = nodes.map((node) => node.production).reduce((a, b) => a + b, 0);
    const hacknetIncome = upgrade === 'Sell for Money' ? (1e6 * hashRate) / 4 : 0;
    putMoneyData(ns, { hacknetIncome });
    putPlayerData(ns, {
      hacknet: {
        servers: nodes,
        studyMult: ns.hacknet.getStudyMult(),
        trainingMult: ns.hacknet.getTrainingMult(),
        nextUpgrade: getTargetUpgrade(ns, goals),
        nextPurchase,
        hashes: ns.hacknet.numHashes(),
        capacity: ns.hacknet.hashCapacity(),
      },
    });

    await ns.sleep(1000);
  }
}
