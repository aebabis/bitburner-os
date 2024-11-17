import { getStaticData } from '/lib/data-store';
import { table } from '/lib/table';

/** @param {NS} ns **/
export const getStocks = (ns) => getStaticData(ns).stocks.map(({ sym, maxShares }) => ({
    sym,
    maxShares,
    position: ns.stock.getPosition(sym),
    price: ns.stock.getPrice(sym),
    getPurchaseCost: (shares) => ns.stock.getPurchaseCost(sym, shares, 'Long'),
    getSaleGain: (shares=ns.stock.getPosition(sym)[0]) => ns.stock.getSaleGain(sym, shares, 'Long'),
    buy: (shares) => ns.stock.buyStock(sym, shares),
    sell: (shares) => ns.stock.sellStock(sym, shares),
}));

/** @param {NS} ns **/
export const optimizeShares = (ns, stock, maxPurchase, money) => {
    let min = 0;
    let max = maxPurchase;
    while (true) {
        let shares = Math.floor((min + max) / 2);
        if (min > max)
            return shares;
        const cost = stock.getPurchaseCost(shares);
        if (cost > money)
            max = shares - 1;
        else
            min = shares + 1;
    }
};

export const getHoldings = (stocks) => stocks
    .map(stock => stock.position[0] * stock.position[1])
    .reduce((a,b)=>a+b,0);

/** @param {NS} ns **/
export const getTableString = (ns, stocks) => {
    const HEAD = ['SYM', 'Shares', '+/-', 'Price'];
    const rows = stocks
        .filter(stock=>stock.position[0] > 0)
        .map((stock) => [stock.sym, stock.position[0], stock.forecast?.toFixed(3)||'', stock.price]);
    return table(ns, HEAD, rows);
};
