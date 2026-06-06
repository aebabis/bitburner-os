import { tprint } from '../../../boot/util';
import { STR } from '../../../lib/colors';
import { getStaticData, putStaticData } from '../../../lib/data-store';

export async function main(ns: NS) {
  ns.disableLog('ALL');
  tprint(ns)(STR + '  Loading Augmentation Rep Costs');

  const { augmentations } = getStaticData(ns);
  const augmentationRepReqs: Record<string, number> = {};

  for (const aug of augmentations!)
    augmentationRepReqs[aug] = ns.singularity.getAugmentationRepReq(aug);

  putStaticData(ns, { augmentationRepReqs });
}
