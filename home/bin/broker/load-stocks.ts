import { putStaticData } from '../../lib/data-store';

export async function main(ns: NS) {
  const stocks = ns.stock.getSymbols().map((sym) => ({
    sym,
    maxShares: ns.stock.getMaxShares(sym),
  }));

  putStaticData(ns, { stocks });
}
