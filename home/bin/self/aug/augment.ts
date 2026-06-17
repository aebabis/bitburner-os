import { tprint } from '../../../boot/util';
import { STR } from '../../../lib/colors';
import { getGoals } from '../../../lib/goals/goals';
import { nmap } from '../../../lib/nmap';
import { rmi } from '../../../lib/rmi';
import { by } from '../../../lib/util';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  const retry = true;

  tprint(ns)(STR.BOLD + 'LOADING AUGMENTATION AND FACTION DATA');
  await rmi(ns, retry)('/bin/self/aug/load-aug-names.ts');
  await rmi(ns, retry)('/bin/self/aug/load-aug-prices.ts');
  await rmi(ns, retry)('/bin/self/aug/load-aug-reps.ts');
  await rmi(ns, retry)('/bin/self/aug/load-aug-prereqs.ts');
  await rmi(ns, retry)('/bin/self/aug/load-aug-stats.ts');
  await rmi(ns, retry)('/bin/self/aug/load-faction-favor.ts');
  await rmi(ns, retry)('/bin/self/aug/load-faction-reqs.ts');
  await rmi(ns, retry)('/bin/self/aug/load-faction-work-types.ts');

  while (true) {
    await rmi(ns, retry)('/bin/self/aug/load-faction-rep.ts');
    ns.print('Loaded rep');
    await rmi(ns, retry)('/bin/self/aug/load-owned-augs.ts');
    ns.print('Loaded augs');
    await rmi(ns, retry)('/bin/self/aug/load-faction-favor-gain.ts');
    ns.print('Loaded favor');
    await rmi(ns)('/bin/self/aug/join-factions.ts');
    ns.print('Loaded factions');

    const root = getGoals(ns);
    if (root.type === 'INSTALL' && root.deps.every((g) => g.isDone())) {
      tprint(ns)(STR.BOLD + 'INSTALLING');
      tprint(ns)(STR + '  Stopping all programs');
      for (const hostname of nmap(ns))
        for (const { pid } of ns.ps(hostname))
          if (pid !== ns.pid) {
            ns.ui.closeTail(pid);
            ns.kill(pid);
          }
      ns.exec('/bin/self/aug/purchase-augs.ts', 'home');
      return;
    }

    await ns.sleep(100);
  }
}
