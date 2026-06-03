import { getStaticData } from '../../lib/data-store';

export function dump(ns: NS) {
  const { stocks = [] } = getStaticData(ns);
  ns.tprint(`Selling all holdings and setting reserve proportion to 100%`);
  for (const { sym } of stocks) ns.stock.sellStock(sym, Infinity);
}

export async function main(ns: NS) {
  try {
    dump(ns);
  } catch (error) {
    console.error(error);
  }
}
