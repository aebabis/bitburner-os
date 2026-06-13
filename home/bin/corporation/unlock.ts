export async function main(ns: NS) {
  ns.disableLog('ALL');

  const { funds } = ns.corporation.getCorporation();

  const canUnlock: Record<CorpUnlockName, () => boolean> = {
    'Smart Supply': () => true,
    Export: () => false,
    'Shady Accounting': () => false,
    'Market Research - Demand': () => false,
    'Market Data - Competition': () => false,
    'Government Partnership': () => false,
    'Warehouse API': () => true,
    'Office API': () => false,
  };

  const unlocks = Object.keys(canUnlock) as CorpUnlockName[];
  for (const unlock of unlocks) {
    if (
      !ns.corporation.hasUnlock(unlock) &&
      ns.corporation.getUnlockCost(unlock) <= funds &&
      canUnlock[unlock]()
    ) {
      ns.corporation.purchaseUnlock(unlock);
    }
  }
}
