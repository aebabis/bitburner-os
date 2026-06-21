import { getNextBitnode } from '../../lib/bitnode-sequence';

export async function main(ns: NS) {
  const resetInfo = ns.getResetInfo();
  ns.singularity.destroyW0r1dD43m0n(getNextBitnode(resetInfo), 'start.ts');
}
