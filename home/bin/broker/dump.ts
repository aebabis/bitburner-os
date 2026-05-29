import { getConfig } from '../../lib/config';
import { getStaticData } from '../../lib/data-store';

export function dump(ns: NS) {
  const { stocks = [] } = getStaticData(ns);
  ns.tprint(`Selling all holdings and setting reserve proportion to 100%`);
  getConfig(ns).set('reserved-funds', 1);
  for (const { sym } of stocks) ns.stock.sellStock(sym, Infinity);
}

export async function main(ns: NS) {
  try {
    dump(ns);
  } catch (error) {
    console.error(error);
  }
}
