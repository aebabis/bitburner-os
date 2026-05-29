import { getStaticData, putStaticData } from '../../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.tprint('Loading Augmentation Rep Costs');

  const { augmentations } = getStaticData(ns);
  const augmentationRepReqs = /** @type {Record<string, number>} */ {};

  for (const aug of augmentations)
    augmentationRepReqs[aug] = ns.singularity.getAugmentationRepReq(aug);

  putStaticData(ns, { augmentationRepReqs });
}
