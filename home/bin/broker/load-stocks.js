import { putStaticData } from '/lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    const stocks = ns.stock.getSymbols().map((sym) => ({
        sym,
        maxShares: ns.stock.getMaxShares(sym),
    }));

    putStaticData(ns, { stocks });
}
