/** @param {NS} ns */
export async function main(ns) {
    ns.print(Date.now());
    await ns.grow(ns.args[0]);
}