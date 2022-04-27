/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tprint('Booting');
	ns.run('/boot/boot.js', 1);
}