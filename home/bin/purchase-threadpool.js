/** @param {NS} ns **/
export async function main(ns) {
	const command = ns.args[0];
	if (command === 'purchase') {
		const ram = +ns.args[1];
		return ns.purchaseServer('THREADPOOL', ram);
	} else if (command === 'replace') {
		const hostnameToKill = ns.args[1];
		const ram = +ns.args[2];
		ns.killall(hostnameToKill);
		ns.deleteServer(hostnameToKill);
		return ns.purchaseServer('THREADPOOL', ram);
	} else {
		throw new Error('Illegal command type ' + command);
	}
}