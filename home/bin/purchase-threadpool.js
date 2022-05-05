import { infect, fullInfect } from './bin/infect';
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

	const isUpgrade = serverToReplace != null;
	const hostname = serverToReplace || getNextServerName(ns);

	if (isUpgrade) {
		ns.killall(hostname);
		ns.deleteServer(hostname);
	}

	ns.purchaseServer(hostname, ram);

	if (isUpgrade)
		logger(ns).log(`Upgraded ${hostname} to ${ram}GB ram for ${priceStr}`);
	else
		logger(ns).log(`Purchased ${hostname} with ${ram}GB ram for ${priceStr}`);

	if (hostname === `${THREADPOOL}-1`)
		await fullInfect(ns, hostname); // We need at least one threadpool for large jobs
	else
		await infect(ns, hostname);
}