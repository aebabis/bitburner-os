import { getStaticData, putStaticData  } from './lib/data-store';

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tprint('Loading Augmentation PreReqs');

    const { augmentations } = getStaticData(ns);
    const augmentationPrereqs = {};

    for (const augmentation of augmentations) {
        augmentationPrereqs[augmentation] = ns.getAugmentationPrereq(augmentation);
    }

    putStaticData(ns, { augmentationPrereqs });
}
