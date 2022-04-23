import { infect } from './bin/infect';
import { logger } from './lib/logger';
import { getHostnames, putHostnames } from './lib/data-store';

/** @param {NS} ns **/
export async function main(ns) {
	const tempDisable = (hostname) => {
		const hostnames = getHostnames(ns).filter(name=>name!==hostname);
		putHostnames(ns, hostnames);
	}
	const command = ns.args[0];
	if (command === 'purchase') {
		const ram = +ns.args[1];
		const hostname = ns.purchaseServer('THREADPOOL', ram);
		if (hostname != null && hostname !== '') {
			tempDisable(hostname);
			await infect(ns, hostname);
		}
	} else if (command === 'replace') {
		const hostnameToKill = ns.args[1];
		const ram = +ns.args[2];
		const money = ns.getServerMoneyAvailable('home');
		const cost = ns.getPurchasedServerCost(ram);
		if (money >= cost) {
			ns.killall(hostnameToKill);
			ns.deleteServer(hostnameToKill);
			const newHostname = ns.purchaseServer('THREADPOOL', ram);
			logger(ns).log(`Purchased ${newHostname} with ${ram}GB ram for ${ns.nFormat(cost, '$0.000a')}`);
			tempDisable(newHostname);
			await infect(ns, newHostname);
		}
	} else {
		throw new Error('Illegal command type ' + command);
	}
}