import { putMoneyData } from '../../lib/data-store';

export function dump(ns: NS) {
  ns.tprint(`Selling all holdings and setting reserve proportion to 100%`);
  // TODO: Consolidate this with the more correct code that checks saleGain
  for (const sym of ns.stock.getSymbols()) {
    ns.stock.sellStock(sym, Infinity);
    try {
      ns.stock.sellShort(sym, Infinity);
    } catch (_error) {
      //
    }
  }
  putMoneyData(ns, { estimatedStockValue: 0 });
}

export async function main(ns: NS) {
  try {
    dump(ns);
  } catch (error) {
    console.error(error);
  }
}
