import { getStaticData, putStaticData  } from '/lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tprint('Loading Augmentation Rep Costs');

    const { augmentations } = getStaticData(ns);
    const augmentationRepReqs = {};

    for (const aug of augmentations)
        augmentationRepReqs[aug] = ns.singularity.getAugmentationRepReq(aug);

    putStaticData(ns, { augmentationRepReqs });
}
