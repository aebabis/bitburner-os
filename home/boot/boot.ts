import { defer } from './defer';
import { tprint } from './util';
import { STR } from '../lib/colors';

const getBootSequence = (ns: NS) => {
  const { currentNode, ownedSF } = ns.getResetInfo();
  const homeRam = ns.getServerMaxRam('home');
  const sequence = [
    '/boot/reset.ts',
    '/boot/ui.ts',
    '/boot/network.ts',
    '/boot/data1.ts',
    '/boot/data2.ts',
    '/boot/data3.ts',
  ];
  if (ownedSF.has(4) || currentNode === 4) {
    if (homeRam >= ns.getScriptRam('/boot/data4.ts')) {
      sequence.push('/boot/data4.ts');
    }
    sequence.push('/boot/data5.ts');
  }
  if (ownedSF.has(10) || currentNode === 10) {
    sequence.push('/boot/data6.ts');
  }
  if (homeRam <= 8) {
    sequence.push('/bin/eight-gig.ts');
  } else {
    sequence.push('/bin/planner.ts');
  }
  return sequence;
};

export async function main(ns: NS) {
  tprint(ns)(STR.BOLD + 'STARTING BOOT SEQUENCE');

  const BOOT_SEQUENCE = getBootSequence(ns);

  await defer(ns)(...BOOT_SEQUENCE);
}
