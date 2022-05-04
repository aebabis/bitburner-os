import { infect } from './bin/infect';
import { logger } from './lib/logger';
import { THREADPOOL } from './etc/config';

const serverExists = (ns, hostname) => {
	try {
		ns.fileExists('DNE.js', hostname);
		return true;
	} catch {
		return false;
	}
};

const getNextServerName = (ns) => {
	const limit = ns.getPurchasedServerLimit();
	for (let n = 1; n <= limit; n++) {
		const serverName = `${THREADPOOL}-${n}`;
		if (!serverExists(ns, serverName))
			return serverName;
	}
}

/** @param {NS} ns **/
export async function main(ns) {
	const [ram, serverToReplace] = ns.args;
	if (isNaN(ram))
		throw new Error(`Illegal RAM value: ${ram}`);

	const money = ns.getServerMoneyAvailable('home');
	const cost = ns.getPurchasedServerCost(ram);
	const priceStr = ns.nFormat(cost, '$0.000a');

	if (money < cost) {
		logger(ns).log(`Could not afford ${priceStr} for ${ram}GB ram`);
		return;
	}

	if (serverToReplace == null) {
		const hostname = getNextServerName(ns);
		ns.purchaseServer(hostname, ram);
		logger(ns).log(`Purchased ${hostname} with ${ram}GB ram for ${priceStr}`);
		await infect(ns, hostname);
	} else {
		ns.killall(serverToReplace);
		ns.deleteServer(serverToReplace);
		ns.purchaseServer(serverToReplace, ram);
		logger(ns).log(`Upgraded ${serverToReplace} to ${ram}GB ram for ${priceStr}`);
		await infect(ns, serverToReplace);
	}
}