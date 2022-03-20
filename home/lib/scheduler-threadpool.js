import { PORT_SCH_THREADPOOL } from './etc/ports';
import Ports from './lib/ports';
import { infect } from './bin/infect';

const PURCHASE = '/bin/purchase-threadpool.js';

/** @param {NS} ns **/
export const purchaseThreadpoolServer = async (ns) => {
	if (ns.getServerMoneyAvailable('home') < ns.getPurchasedServerCost(2))
		return false;
	
	if (ns.exec(PURCHASE, 'home') === 0) {
		ns.print('Could not run purchase script');
		return null;
	}

	const start = Date.now();
	const waitTime = () => Date.now() - start;
	while (waitTime < 5000 && (await Ports(ns).peek(PORT_SCH_THREADPOOL)) == null)
		await ns.sleep(50);
	hostname = await ns.readPort(PORT_SCH_THREADPOOL);
	if (hostname == null) {
		ns.print('Server purchase timed out')
		return null;
	} else if (hostname === '') {
		ns.print('Failed to purchase server');
		return hostname;
	} else {
		await infect(ns, hostname);
		return hostname;
	}
}