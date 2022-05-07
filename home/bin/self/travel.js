/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.travelToCity(ns.args[0]);
}