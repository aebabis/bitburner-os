import { write } from './lib/util';
import { getBestPurchase } from './lib/hacknet';

const DATFILE = '/var/data-hacknet.txt';

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	
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
				await write(ns)(DATFILE, `WA: ${purchase.toString()}`, 'w');
				ns.print(`WA: ${purchase.toString()}`);
				waitMessageShown = true;
				lastMessageTime = Date.now();
			}
			await ns.sleep(1000);
		}
	}
}