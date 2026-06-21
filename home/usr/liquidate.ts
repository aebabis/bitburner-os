import { disableService } from '../lib/service-api';
import { hasBitNode } from '../lib/query-service';
import { rmi } from '../lib/rmi';

export const liquidate = async (ns: NS) => {
  // Prevent money from being spent
  await disableService(ns, 'hacknet');
  await disableService(ns, 'sysadmin');
  await disableService(ns, 'broker');
  if (hasBitNode(ns, 4)) await disableService(ns, 'tor');

  // Wait for services to stop.
  await ns.sleep(1000);

  // Sell stocks
  if (ns.stock.hasTixApiAccess()) await rmi(ns)('/bin/broker/dump.ts');
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  await liquidate(ns);
}
