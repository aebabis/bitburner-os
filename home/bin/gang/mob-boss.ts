import { rmi } from '../../lib/rmi';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  while (!ns.gang.inGang()) {
    ns.gang.createGang('Slum Snakes');
    await ns.sleep(1000);
  }

  await rmi(ns)('/bin/gang/gang-data.ts');

  while (true) {
    await rmi(ns)('/bin/gang/recruit.ts');
    await rmi(ns)('/bin/gang/assign-members.ts');
    await ns.sleep(5000);
  }
}
