import { disableService } from './lib/service-api';
import { rmi } from './lib/rmi';

export const liquidate = async (ns) => {
    // Prevent money from being spent
    await disableService(ns, 'hacknet');
    await disableService(ns, 'market-access');
    await disableService(ns, 'server-purchaser');
    await disableService(ns, 'tor');

    // Wait for services to stop.
    await ns.sleep(1000);

    // Sell stocks
    if (ns.getPlayer().hasTixApiAccess)
        await rmi(ns)('/bin/broker.js', 1, 'dump');
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    await liquidate(ns);
}
