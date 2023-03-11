import { disableService } from './lib/service-api';
import { hasBitNode } from './lib/query-service';
import { rmi } from './lib/rmi';

export const liquidate = async (ns) => {
    // Prevent money from being spent
    await disableService(ns, 'hacknet');
    await disableService(ns, 'sysadmin');
    await disableService(ns, 'broker');
    if (hasBitNode(ns, 4))
        await disableService(ns, 'tor');

    // Wait for services to stop.
    await ns.sleep(1000);

    // Sell stocks
    if (ns.stock.hasTIXAPIAccess())
        await rmi(ns)('/bin/broker/dump.js');
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    await liquidate(ns);
}