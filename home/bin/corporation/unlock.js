/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const { funds } = ns.corporation.getCorporation();

  /** @constant */
  const canUnlock = {
    'Smart Supply': () => true,
    'Export': () => false,
    'Shady Accounting': () => false,
    'Market Research - Demand': () => false,
    'Market Data - Competition': () => false,
    'Government Partnership': () => false,
    'Warehouse API': () => false,
    'Office API': () => false,
  };

  for (const unlock in canUnlock) {
    if (!ns.corporation.hasUnlock(unlock) &&
      ns.corporation.getUnlockCost(unlock) <= funds &&
      canUnlock[unlock]()) {
      ns.corporation.purchaseUnlock(unlock);
    }
  }
}
