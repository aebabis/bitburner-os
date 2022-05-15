import { getBestPurchase } from './lib/hacknet';
import { logger } from './lib/logger';
import { estimateTimeToGoal } from './lib/query-service';

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	const console = logger(ns);
	
	const BUFFER_FACTOR = 1.2;
	let waitMessageShown = false;
	let lastMessageTime = 0;
	while (true) {
		const purchase = await getBestPurchase(ns);
		const timeToGoal = estimateTimeToGoal(ns);
		if (timeToGoal != null && purchase.breakEvenTime > timeToGoal) {
			const hours = (purchase.breakEvenTime/60/60).toFixed(2);
			ns.print(`Not purchasing hacknet upgrade. Break even time: ${hours}h`);
			await ns.sleep(10000);
			continue;
		}
		const money = ns.getServerMoneyAvailable('home');
		const factor = purchase.cost <= 1000 ? 1 : BUFFER_FACTOR;
		if (money >= factor * purchase.cost) {
			ns.print(`PO: ${purchase.toString()}`);
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