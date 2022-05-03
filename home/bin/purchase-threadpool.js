import { infect } from './bin/infect';
import { logger } from './lib/logger';

/** @param {NS} ns **/
export async function main(ns) {
	const [command, hostname, ram] = ns.args;
	const money = ns.getServerMoneyAvailable('home');
	const cost = ns.getPurchasedServerCost(ram);
	const priceStr = ns.nFormat(cost, '$0.000a');

	if (command === 'purchase') {
		if (ns.purchaseServer(hostname, ram) !== '') {
			logger(ns).log(`Purchased ${hostname} with ${ram}GB ram for ${priceStr}`);
			await infect(ns, hostname);
		}
	} else if (command === 'replace') {
		if (money >= cost) {
			ns.killall(hostname);
			ns.deleteServer(hostname);
			ns.purchaseServer(hostname, ram);
			logger(ns).log(`Upgraded ${hostname} to ${ram}GB ram for ${priceStr}`);
			await infect(ns, hostname);
		}
	} else {
		throw new Error('Illegal command type ' + command);
	}
}