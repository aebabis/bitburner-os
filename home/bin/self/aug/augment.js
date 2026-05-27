import { rmi } from '../../../lib/rmi';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  const retry = true;

  await rmi(ns, retry)('/bin/self/aug/load-faction-favor.js');
  await rmi(ns, retry)('/bin/self/aug/load-aug-names.js');
  await rmi(ns, retry)('/bin/self/aug/load-aug-prices.js');
  await rmi(ns, retry)('/bin/self/aug/load-aug-reps.js');
  await rmi(ns, retry)('/bin/self/aug/load-aug-prereqs.js');
  await rmi(ns, retry)('/bin/self/aug/load-aug-stats.js');
  await rmi(ns, retry)('/bin/self/aug/load-faction-reqs.js');

  while (true) {
    await rmi(ns, retry)('/bin/self/aug/load-owned-augs.js');
    ns.print('Loaded augs');
    await rmi(ns, retry)('/bin/self/aug/load-faction-favor-gain.js');
    ns.print('Loaded favor');
    await rmi(ns)('/bin/self/aug/join-factions.js');
    ns.print('Loaded factions');
    await rmi(ns)('/bin/self/aug/purchase-augs.js');
    ns.print('Checked augs');
    await ns.sleep(100);
  }
}
