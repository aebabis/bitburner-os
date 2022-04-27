/** @param {NS} ns */
export async function main(ns) {
    ns.args.forEach(ns.connect);
    await ns.installBackdoor();
}