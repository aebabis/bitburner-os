import { disableService } from './lib/service-api';
import { rmi } from './lib/rmi';

export const liquidate = async (ns) => {
    // Prevent money from being spent
    disableService(ns, 'hacknet');
    disableService(ns, 'market-access');
    disableService(ns, 'server-purchaser');
    disableService(ns, 'tor');

    // Wait one cycle for services to stop.
    // Probably unnecessary.
    await ns.sleep(50);

    // Sell stocks
    if (ns.getPlayer().hasTixApiAccess)
        await rmi(ns)('/bin/broker.js', 1, 'dump');
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    await liquidate(ns);
}