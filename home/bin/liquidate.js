import { disableService } from './lib/service-api';
import { rmi } from './lib/rmi';

export const liquidate = async (ns) => {
    // Prevent money from being spent
    await disableService(ns, 'hacknet');
    await disableService(ns, 'sysadmin');
    await disableService(ns, 'broker');
    await disableService(ns, 'tor');

    // Wait for services to stop.
    await ns.sleep(1000);

    // Sell stocks
    if (ns.getPlayer().hasTixApiAccess)
        await rmi(ns)('/bin/broker/dump.js');
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    await liquidate(ns);
}