import { getBestPurchase } from './lib/hacknet';
import { logger } from './logger';

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	const console = logger(ns);
	
	const BUFFER_FACTOR = 1.25;
	let waitMessageShown = false;
	let lastMessageTime = 0;
	while (true) {
		const purchase = await getBestPurchase(ns);
		const money = ns.getServerMoneyAvailable('home');
		if (money > BUFFER_FACTOR * purchase.cost) {
			ns.print(`PO: ${purchase.toString()}`)
			purchase.purchase();
			waitMessageShown = false;
		} else {
			if (!waitMessageShown && (Date.now() - lastMessageTime > 10000)) {
				await console.log(`WA: ${purchase.toString()}`);
				ns.print(`WA: ${purchase.toString()}`);
				waitMessageShown = true;
				lastMessageTime = Date.now();
			}
			await ns.sleep(1000);
		}
	}
}
