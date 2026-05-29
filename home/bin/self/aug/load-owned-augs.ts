import { putPlayerData } from '../../../lib/data-store';

/** @param {NS} ns */
export const getPurchasedAugmentations = (ns) => {
  const installedAugmentations = ns.singularity.getOwnedAugmentations(false);
  const ownedAugmentations = ns.singularity.getOwnedAugmentations(true);
  const purchasedAugmentations = ownedAugmentations.slice();
  for (const aug of installedAugmentations)
    purchasedAugmentations.splice(purchasedAugmentations.indexOf(aug), 1);
  return purchasedAugmentations;
};

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog('ALL');
  putPlayerData(ns, {
    purchasedAugmentations: getPurchasedAugmentations(ns),
  });
}
