export function levelUpgradeProfit(currentLevel, currentRam, currentLevelCore) {
    return (1*1.5) * Math.pow(1.035,currentRam-1) * ((currentLevelCore+5)/6);
}
export function ramUpgradeProfit(currentLevel, currentRam, currentLevelCore) {
    return (currentLevel*1.5) * (Math.pow(1.035,(2*currentRam)-1) - Math.pow(1.035,currentRam-1)) * ((currentLevelCore+5)/6);
}
export function coreUpgradeProfit(currentLevel, currentRam, currentLevelCore) {
    return (currentLevel*1.5) * Math.pow(1.035,currentRam-1) * (1/6);
}

export const getNodeData = (ns) => {
    const numNodes = ns.hacknet.numNodes();
    const nodes = new Array(numNodes).fill(null).map((_, i) => ns.hacknet.getNodeStats(i));
    const prodFactor = ns.getHacknetMultipliers().production;
    const m = n => ns.nFormat(n, '$0.a');
    return nodes.map((stats, i) => {
        const lp = prodFactor * levelUpgradeProfit(stats.level, stats.ram, stats.cores);
        const rp = prodFactor * ramUpgradeProfit(stats.level, stats.ram, stats.cores);
        const cp = prodFactor * coreUpgradeProfit(stats.level, stats.ram, stats.cores);
        const lc = ns.hacknet.getLevelUpgradeCost(i);
        const rc = ns.hacknet.getRamUpgradeCost(i);
        const cc = ns.hacknet.getCoreUpgradeCost(i);
        const upgrades = {
            level: { type: 'level', index: i, profit: lp, cost: lc, profitPerCost: lp / lc, breakEvenTime: lc / lp,
                purchase: () => ns.hacknet.upgradeLevel(i), toString: () => `${i}-level ${m(lp)}/${m(lc)}` },
            ram: { type: 'ram', index: i, profit: rp, cost: rc, profitPerCost: rp / rc, breakEvenTime: rc / rp,
                purchase: () => ns.hacknet.upgradeRam(i) , toString: () => `${i}-ram ${m(rp)}/${m(rc)}` },
            core: { type: 'core', index: i, profit: cp, cost: cc, profitPerCost: cp / cc, breakEvenTime: cc / cp,
                purchase: () => ns.hacknet.upgradeCore(i), toString: () => `${i}-core ${m(cp)}/${m(cc)}` },
            getBest: () => [upgrades.level, upgrades.ram, upgrades.core].reduce(
                (a, b) => {
                    if (a.profitPerCost > b.profitPerCost)
                        return a;
                    return b;
                }),
                    // a.profitPerCost > b.profitPerCost ? a : b),
        };
        return { ...stats, upgrades };
    });
}

export const getBestUpgrade = (ns) => {
    const upgrades = getNodeData(ns).map(stats => stats.upgrades.getBest());
    return upgrades.reduce((a, b) => a.profitPerCost > b.profitPerCost ? a : b, upgrades[0] || null);
}

export const getBestPurchase = (ns) => {
    const bestUpgrade = getBestUpgrade(ns);
    const nodeCost = ns.hacknet.getPurchaseNodeCost();
    if (bestUpgrade == null || nodeCost < bestUpgrade.cost) {
        return { profit: null, cost: nodeCost, profitPerCost: null, breakEvenTime: null,
            purchase: () => ns.hacknet.purchaseNode(), toString: () => `core $${nodeCost}`}
    } else {
        return bestUpgrade;
    }
}