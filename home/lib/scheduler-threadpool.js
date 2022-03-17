import { PORT_SCH_THREADPOOL } from './etc/ports';
// import { execAnyHost } from './lib/scheduler-api';

const THREADPOOL_NAME = 'THREADPOOL';
const PURCHASE = '/bin/purchase-threadpool.js';
const PURCHASE_SRC = `
import { by } from './lib/util';

/** @param {NS} ns **/
export async function main(ns) {
	const getServer = () => {
		const money = ns.getServerMoneyAvailable('home');
		const servers = ns.getPurchasedServers().map(ns.getServer).sort(by(s=>s.maxRam));;
		if (servers.length === ns.getPurchasedServerLimit()) {
			const smallest = servers.shift();
			const biggest  = servers.pop();
			const lowerLimit = smallest.maxRam * 2;
			const upperLimit = biggest.maxRam * 2;

			if (smallest.ram === ns.getPurchasedServerMaxRam()) {
				return
			}
			
			let ram = upperLimit;
			while (ram >= lowerLimit && ram <= ns.getPurchasedServerMaxRam()) {
				const cost = ns.getPurchasedServerCost(ram);
				if (cost <= money) {
					// ns.tprint('Killing ' + smallest.hostname + ' ' + smallest.maxRam);
					ns.killall(smallest.hostname);
					ns.deleteServer(smallest.hostname);
					return ns.purchaseServer('${THREADPOOL_NAME}', ram);
				} else {
					ram >>= 1;
				}
			}
		} else {
			let ram = ns.getPurchasedServerMaxRam();
			while (ram >= 2) {
				const cost = ns.getPurchasedServerCost(ram);
				if (cost <= money)
					return ns.purchaseServer('${THREADPOOL_NAME}', ram);
				ram >>= 1;
			}
		}
	}
	ns.writePort(${PORT_SCH_THREADPOOL}, getServer() || '');
}`;

let wrotePurchaseSrc = false;
/** @param {NS} ns **/
export const purchaseThreadpoolServer = async (ns) => {
	if (ns.getServerMoneyAvailable('home') < ns.getPurchasedServerCost(2))
		return false;
	if (!wrotePurchaseSrc) {
		wrotePurchaseSrc = true;
		await ns.write(PURCHASE, PURCHASE_SRC, 'w');
	}
	// await execAnyHost(ns)(PURCHASE);
	let hostname;
	if (hostname = ns.purchaseServer(THREADPOOL_NAME, 2))
		return hostname;
	
	ns.exec(PURCHASE, 'home');

	ns.print('buying?');
	while ((await ns.peek(PORT_SCH_THREADPOOL)) === 'NULL PORT DATA')
		await ns.sleep(50);
	hostname = await ns.readPort(PORT_SCH_THREADPOOL);
	ns.print(hostname);
	return hostname;
}