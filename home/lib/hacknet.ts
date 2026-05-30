import { formulas as getFormulas } from './formulas';

export const getNodes = (ns: NS) => {
  const numNodes = ns.hacknet.numNodes();
  return new Array(numNodes)
    .fill(null)
    .map((_, i) => ns.hacknet.getNodeStats(i));
};

const getNodeData = (ns: NS) => {
  const formulas = getFormulas(ns);
  const { moneyGainRate } = formulas.hacknetNodes;
  const levelUpgradeProfit = (level: number, ram: number, cores: number) =>
    moneyGainRate(level + 1, ram, cores) - moneyGainRate(level, ram, cores);
  const ramUpgradeProfit = (level: number, ram: number, cores: number) =>
    moneyGainRate(level, ram + 1, cores) - moneyGainRate(level, ram, cores);
  const coreUpgradeProfit = (level: number, ram: number, cores: number) =>
    moneyGainRate(level, ram, cores + 1) - moneyGainRate(level, ram, cores);

  const m = (n?: number | null) => n && '$' + ns.format.number(n, 0);
  return getNodes(ns).map((stats, i) => {
    const lp = levelUpgradeProfit(stats.level, stats.ram, stats.cores);
    const rp = ramUpgradeProfit(stats.level, stats.ram, stats.cores);
    const cp = coreUpgradeProfit(stats.level, stats.ram, stats.cores);
    const lc = ns.hacknet.getLevelUpgradeCost(i, 1);
    const rc = ns.hacknet.getRamUpgradeCost(i, 1);
    const cc = ns.hacknet.getCoreUpgradeCost(i, 1);
    const upgrades = {
      level: {
        type: 'level',
        index: i,
        profit: lp,
        cost: lc,
        profitPerCost: lp / lc,
        breakEvenTime: lc / lp,
        purchase: () => ns.hacknet.upgradeLevel(i, 1),
        toString: () => `${i}-level ${m(lp)}/${m(lc)}`,
      },
      ram: {
        type: 'ram',
        index: i,
        profit: rp,
        cost: rc,
        profitPerCost: rp / rc,
        breakEvenTime: rc / rp,
        purchase: () => ns.hacknet.upgradeRam(i, 1),
        toString: () => `${i}-ram ${m(rp)}/${m(rc)}`,
      },
      core: {
        type: 'core',
        index: i,
        profit: cp,
        cost: cc,
        profitPerCost: cp / cc,
        breakEvenTime: cc / cp,
        purchase: () => ns.hacknet.upgradeCore(i, 1),
        toString: () => `${i}-core ${m(cp)}/${m(cc)}`,
      },
      getBest: () =>
        [upgrades.level, upgrades.ram, upgrades.core].reduce((a, b) => {
          if (a.profitPerCost > b.profitPerCost) return a;
          return b;
        }),
    };
    return { ...stats, upgrades };
  });
};

const getBestUpgrade = (ns: NS) => {
  const upgrades = getNodeData(ns).map((stats) => stats.upgrades.getBest());
  return upgrades.reduce(
    (a, b) => (a.profitPerCost > b.profitPerCost ? a : b),
    upgrades[0] || null,
  );
};

export const getBestPurchase = (ns: NS) => {
  const bestUpgrade = getBestUpgrade(ns);
  const nodeCost = ns.hacknet.getPurchaseNodeCost();
  if (bestUpgrade == null || nodeCost < bestUpgrade.cost) {
    const profit =
      ns.hacknet.numNodes() > 0 ? ns.hacknet.getNodeStats(0).production : 0;
    const profitPerCost = profit / nodeCost;
    const breakEvenTime = profit === 0 ? 0 : nodeCost / profit;
    return {
      type: 'node',
      profit,
      cost: nodeCost,
      profitPerCost,
      breakEvenTime,
      purchase: () => ns.hacknet.purchaseNode(),
      toString: () => `node $${nodeCost}`,
    };
  } else {
    return bestUpgrade;
  }
};
