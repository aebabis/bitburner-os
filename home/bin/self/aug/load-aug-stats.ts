import { getStaticData, putStaticData } from '../../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  ns.tprint('Loading Augmentation Stats');

  const { augmentations } = getStaticData(ns);
  const augmentationStats: Record<string, Multipliers> = {};

  for (const aug of augmentations!)
    augmentationStats[aug] = ns.singularity.getAugmentationStats(aug);

  putStaticData(ns, { augmentationStats });
}
