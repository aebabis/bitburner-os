import { disableService } from '../lib/service-api';
import { rmi } from '../lib/rmi';

export const liquidate = async (ns: NS) => {
  // Prevent money from being spent
  await disableService(ns, 'sysadmin');
  await disableService(ns, 'trader');

  // Wait for services to stop.
  await ns.sleep(1000);

  // Sell stocks
  if (ns.stock.hasTixApiAccess()) await rmi(ns)('/bin/broker/dump.ts');
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  await liquidate(ns);
}
