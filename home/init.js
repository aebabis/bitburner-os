/** @param {NS} ns **/
export async function main(ns) {
    if (ns.getHostname() !== 'home')
        throw new Error(ns.getScriptName() + ' can only run on home');
    ns.disableLog('ALL');
    ns.tprint('Booting');
	ns.run('/boot/boot.js', 1);
}