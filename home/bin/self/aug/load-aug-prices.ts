import { tprint } from '../../../boot/util';
import { STR } from '../../../lib/colors';
import { getStaticData, putStaticData } from '../../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  tprint(ns)(STR + '  Loading Augmentation Prices');

  const { augmentations } = getStaticData(ns);
  const augmentationPrices = /** @type {Record<string, number>} */ {};

  for (const aug of augmentations)
    augmentationPrices[aug] = ns.singularity.getAugmentationBasePrice(aug);

  putStaticData(ns, { augmentationPrices });
}
