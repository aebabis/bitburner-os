import { tprint } from '../../../boot/util';
import { STR } from '../../../lib/colors';
import { getStaticData, putStaticData } from '../../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  tprint(ns)(STR + '  Loading Augmentation PreReqs');

  const { augmentations } = getStaticData(ns);
  if (augmentations == null) {
    throw new Error('Aug data loader sequencing error');
  }
  const augmentationPrereqs: Record<string, string[]> = {};

  for (const aug of augmentations)
    augmentationPrereqs[aug] = ns.singularity.getAugmentationPrereq(aug);

  putStaticData(ns, { augmentationPrereqs });
}
