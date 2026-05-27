import { putPlayerData } from '../../../lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  putPlayerData(ns, {
    purchasedAugmentations: ns.singularity.getOwnedAugmentations(true),
  });
}
