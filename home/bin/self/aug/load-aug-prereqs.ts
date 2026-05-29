import { getStaticData, putStaticData } from '../../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.tprint('Loading Augmentation PreReqs');

  const { augmentations } = getStaticData(ns);
  const augmentationPrereqs = /** @type {Record<string, string[]>} */ {};

  for (const aug of augmentations)
    augmentationPrereqs[aug] = ns.singularity.getAugmentationPrereq(aug);

  putStaticData(ns, { augmentationPrereqs });
}
