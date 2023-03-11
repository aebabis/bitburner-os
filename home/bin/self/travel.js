/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.singularity.travelToCity(ns.args[0]);
}