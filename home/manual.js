import { liquidate } from './bin/liquidate';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    await liquidate(ns);
}