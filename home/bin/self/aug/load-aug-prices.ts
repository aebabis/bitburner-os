import { getStaticData, putStaticData } from '../../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.tprint('Loading Augmentation Prices');

  const { augmentations } = getStaticData(ns);
  const augmentationPrices = /** @type {Record<string, number>} */ {};

  for (const aug of augmentations)
    augmentationPrices[aug] = ns.singularity.getAugmentationBasePrice(aug);

  putStaticData(ns, { augmentationPrices });
}
