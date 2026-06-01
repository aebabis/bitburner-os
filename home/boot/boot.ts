import { defer } from './defer';
import { tprint } from './util';
import { STR } from '../lib/colors';

const getBootSequence = (ns: NS) => {
  const controller =
    ns.getServerMaxRam('home') <= 8 ? '/bin/eight-gig.ts' : '/bin/scheduler.ts';
  return [
    '/boot/reset.ts',
    '/boot/ui.ts',
    '/boot/network.ts',
    '/boot/data.ts',
    '/boot/data2.ts',
    '/boot/data3.ts',
    controller,
  ];
};

export async function main(ns: NS) {
  tprint(ns)(STR.BOLD + 'STARTING BOOT SEQUENCE');

  const BOOT_SEQUENCE = getBootSequence(ns);

  await defer(ns)(...BOOT_SEQUENCE);
}
