import { getStaticData, putStaticData  } from './lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tprint('Loading Augmentation Stats');

    const { augmentations } = getStaticData(ns);
    const augmentationStats = {};

    for (const aug of augmentations)
        augmentationStats[aug] = ns.getAugmentationStats(aug);

    putStaticData(ns, { augmentationStats });
}
