import { putPlayerData } from '../../../lib/data-store';

export const getPurchasedAugmentations = (ns: NS) => {
  const installedAugmentations = ns.singularity.getOwnedAugmentations(false);
  const ownedAugmentations = ns.singularity.getOwnedAugmentations(true);
  const purchasedAugmentations = ownedAugmentations.slice();
  for (const aug of installedAugmentations)
    purchasedAugmentations.splice(purchasedAugmentations.indexOf(aug), 1);
  return purchasedAugmentations;
};

export async function main(ns: NS) {
  ns.disableLog('ALL');
  putPlayerData(ns, { purchasedAugmentations: getPurchasedAugmentations(ns) });
}
