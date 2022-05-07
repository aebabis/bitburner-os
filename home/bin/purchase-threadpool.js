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
		const num = n.toString().padStart(2, '0');
		const serverName = `${THREADPOOL}-${num}`;
		if (!serverExists(ns, serverName))
			return serverName;
	}
}

/** @param {NS} ns **/
export async function main(ns) {
	const [minRam, serverToReplace] = ns.args;
	if (isNaN(ram))
		throw new Error(`Illegal RAM value: ${minRam}`);

	const money = ns.getServerMoneyAvailable('home');
	const cost = ns.getPurchasedServerCost(minRam);
	const priceStr = ns.nFormat(cost, '$0.000a');

	if (money < cost) {
		logger(ns).log(`Could not afford ${priceStr} for ${minRam}GB ram`);
		return;
	}

	const isUpgrade = serverToReplace != null;
	const hostname = serverToReplace || getNextServerName(ns);

	if (isUpgrade) {
		ns.killall(hostname);
		ns.deleteServer(hostname);
	}

	let ram = minRam * 8;
	while (!ns.purchaseServer(hostname, ram))
		ram /= 2;

	if (isUpgrade)
		logger(ns).log(`Upgraded ${hostname} to ${ram}GB ram for ${priceStr}`);
	else
		logger(ns).log(`Purchased ${hostname} with ${ram}GB ram for ${priceStr}`);

	if ([`${THREADPOOL}-01`, `${THREADPOOL}-02`].includes(hostname))
		await fullInfect(ns, hostname); // We need at least one threadpool for large jobs
	else
		await infect(ns, hostname);
}