import { rmi } from '../../../lib/rmi';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const retry = true;

  await rmi(ns, retry)('/bin/self/aug/load-faction-favor.ts');
  await rmi(ns, retry)('/bin/self/aug/load-aug-names.ts');
  await rmi(ns, retry)('/bin/self/aug/load-aug-prices.ts');
  await rmi(ns, retry)('/bin/self/aug/load-aug-reps.ts');
  await rmi(ns, retry)('/bin/self/aug/load-aug-prereqs.ts');
  await rmi(ns, retry)('/bin/self/aug/load-aug-stats.ts');
  await rmi(ns, retry)('/bin/self/aug/load-faction-work-types.ts');
  await rmi(ns, retry)('/bin/self/aug/load-faction-reqs.ts');

  while (true) {
    await rmi(ns, retry)('/bin/self/aug/load-faction-rep.ts');
    ns.print('Loaded rep');
    await rmi(ns, retry)('/bin/self/aug/load-owned-augs.ts');
    ns.print('Loaded augs');
    await rmi(ns, retry)('/bin/self/aug/load-faction-favor-gain.ts');
    ns.print('Loaded favor');
    await rmi(ns)('/bin/self/aug/join-factions.ts');
    ns.print('Loaded factions');
    await rmi(ns)('/bin/self/aug/purchase-augs.ts');
    ns.print('Checked augs');
    await ns.sleep(100);
  }
}
