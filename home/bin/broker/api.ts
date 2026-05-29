import { getStaticData } from '../../lib/data-store';
import { table } from '../../lib/table';

/** @typedef {{sym: string, maxShares: number, position: [number, number, number, number], price: number, forecast: number | null | undefined, getPurchaseCost: (shares: number) => number, getSaleGain: (shares?: number) => number, buy: (shares: number) => number, sell: (shares: number) => number}} Stock */

/** @param {NS} ns **/
export const getStocks = (ns) =>
  getStaticData(ns).stocks.map(
    (/** @type {{sym: string, maxShares: number}} */ { sym, maxShares }) => ({
      sym,
      maxShares,
      position: ns.stock.getPosition(sym),
      price: ns.stock.getPrice(sym),
      getPurchaseCost: (/** @type {number} */ shares) =>
        ns.stock.getPurchaseCost(sym, shares, 'L'),
      getSaleGain: (
        /** @type {number} */ shares = ns.stock.getPosition(sym)[0],
      ) => ns.stock.getSaleGain(sym, shares, 'L'),
      buy: (/** @type {number} */ shares) => ns.stock.buyStock(sym, shares),
      sell: (/** @type {number} */ shares) => ns.stock.sellStock(sym, shares),
    }),
  );

/** @param {NS} ns @param {Stock} stock @param {number} maxPurchase @param {number} money **/
export const optimizeShares = (ns, stock, maxPurchase, money) => {
  let min = 0;
  let max = maxPurchase;
  while (true) {
    let shares = Math.floor((min + max) / 2);
    if (min > max) return shares;
    const cost = stock.getPurchaseCost(shares);
    if (cost > money) max = shares - 1;
    else min = shares + 1;
  }
};

/** @param {Stock[]} stocks */
export const getHoldings = (stocks) =>
  stocks
    .map((stock) => stock.position[0] * stock.position[1])
    .reduce((/** @type {number} */ a, /** @type {number} */ b) => a + b, 0);

/** @param {NS} ns @param {Stock[]} stocks **/
export const getTableString = (ns, stocks) => {
  const HEAD = ['SYM', 'Shares', '+/-', 'Price'];
  const rows = stocks
    .filter((stock) => stock.position[0] > 0)
    .map((stock) => [
      stock.sym,
      stock.position[0],
      stock.forecast?.toFixed(3) || '',
      stock.price,
    ]);
  return table(ns, HEAD, rows);
};
