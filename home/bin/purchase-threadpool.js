import { infect } from './bin/infect';
import { logger } from './lib/logger';

/** @param {NS} ns **/
export async function main(ns) {
	const command = ns.args[0];
	if (command === 'purchase') {
		const ram = +ns.args[1];
		for (let n = 1; n <= 24; n++) {
			const hostname = ns.purchaseServer('THREADPOOL-'+n, ram);
			if (hostname != null && hostname !== '') {
				await infect(ns, hostname);
				return;
			}
		}
	} else if (command === 'replace') {
		const hostnameToKill = ns.args[1];
		const ram = +ns.args[2];
		const money = ns.getServerMoneyAvailable('home');
		const cost = ns.getPurchasedServerCost(ram);
		if (money >= cost) {
			ns.killall(hostnameToKill);
			ns.deleteServer(hostnameToKill);
			const newHostname = ns.purchaseServer(hostnameToKill, ram);
			logger(ns).log(`Purchased ${newHostname} with ${ram}GB ram for ${ns.nFormat(cost, '$0.000a')}`);
			await infect(ns, newHostname);
		}
	} else {
		throw new Error('Illegal command type ' + command);
	}
}