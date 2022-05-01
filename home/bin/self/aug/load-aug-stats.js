import { getStaticData, putStaticData  } from './lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tprint('Loading Augmentation Stats');

    const { augmentations } = getStaticData(ns);
    const augmentationStats = {};

    for (const augmentation of augmentations) {
        augmentationStats[augmentation] = ns.getAugmentationStats(augmentation);
    }

    putStaticData(ns, { augmentationStats });
}
