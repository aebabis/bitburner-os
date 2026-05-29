import { defer } from './defer';
import { tprint } from './util';
import { STR } from '../lib/colors';

/** @param {NS} ns */
const getBootSequence = (ns) => {
  if (ns.getServerMaxRam('home') < ns.getScriptRam('/boot/data2.ts')) {
    return [
      '/boot/reset.ts',
      '/boot/ui.ts',
      '/boot/network.ts',
      '/boot/data.ts',
      ['/boot/spawn.ts', '/boot/data2-lite.ts'],
      '/bin/eight-gig.ts',
    ];
  } else {
    return [
      '/boot/reset.ts',
      '/boot/ui.ts',
      '/boot/network.ts',
      '/boot/data.ts',
      '/boot/data2.ts',
      '/boot/data3.ts',
      '/bin/scheduler.ts',
    ];
  }
};

/** @param {NS} ns */
export async function main(ns) {
  tprint(ns)(STR.BOLD + 'STARTING BOOT SEQUENCE');

  const BOOT_SEQUENCE = getBootSequence(ns);

  await defer(ns)(...BOOT_SEQUENCE);
}
