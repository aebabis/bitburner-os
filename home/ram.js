/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    let ram = 1;
    let max = ns.getPurchasedServerMaxRam();
    while (ram <= max) {
        const cost = ns.formatNumber(ns.getPurchasedServerCost(ram), 3).padStart(10);
        ns.tprint(ram.toString().padStart(10) + ' ' + cost);
        ram *= 2;
    }
}
