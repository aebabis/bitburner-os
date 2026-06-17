import { inPlace } from '../../../lib/in-place';

export const getPurchasedAugmentations = async (ns: NS) => {
  const installedAugmentations = await inPlace(ns).singularity['getOwnedAugmentations'](false);
  const ownedAugmentations = await inPlace(ns).singularity['getOwnedAugmentations'](true);
  const purchasedAugmentations = ownedAugmentations.slice();
  for (const aug of installedAugmentations)
    purchasedAugmentations.splice(purchasedAugmentations.indexOf(aug), 1);
  return purchasedAugmentations;
};
