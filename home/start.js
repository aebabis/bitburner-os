/** @param {NS} ns **/
export async function main(ns) {
    if (ns.getHostname() !== 'home')
        throw new Error(ns.getScriptName() + ' can only run on home');
    await ns.sleep(50); // To avoid RAM problems on 8GB machines
    ns.disableLog('ALL');
    ns.tprint('About to reboot...');
	ns.run('/boot/boot.js', 1);
}